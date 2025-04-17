import { Editor, MarkdownView, TFile } from "obsidian";
import { gctx } from "src/context";
import TypingPlugin from "src/main";
import { FieldLocation, Type } from "src/typing";

export let regexField = /^\s*(?<field>[0-9\w\p{Letter}][-0-9\w\p{Letter}]*)\s*::\s*(?<value>.*)\s*/u;

export type FieldSearchResult = {
    success: false;
    lineno?: undefined;
    match?: undefined;
} | {
    success: true;
    lineno: number;
    match: RegExpExecArray & { groups: { field: string } };
}

export interface IFieldAccessor {
    getValue(key: string): string | null | Promise<string | null>;
    setValue(key: string, value: string): void | Promise<void>;
}

export class FrontmatterFieldAccessor implements IFieldAccessor {
    constructor(public file: TFile, public plugin: TypingPlugin, public type: Type) { }

    getValue(key: string): string | null | Promise<string | null> {
        return this.plugin.app.metadataCache.getCache(this.file.path)?.frontmatter?.[key] ?? null;
    }

    async setValue(key: string, value: string): Promise<void> {
        await this.plugin.app.fileManager.processFrontMatter(this.file, frontmatter => {
            frontmatter[key] = value
        });
    }
}

export class FieldDependentFieldAccessor implements IFieldAccessor {
    constructor(public type: Type, public accessors: Record<FieldLocation, IFieldAccessor>) { }

    getValue(key: string): string | null | Promise<string | null> {
        if (this.type.fields[key].location ?? "frontmatter" === "frontmatter") {
            return this.accessors.frontmatter.getValue(key);
        } else {
            return this.accessors.inline.getValue(key);
        }
    }

    setValue(key: string, value: string): void | Promise<void> {
        // TODO: Moving fields from frontmatter to inline or vice versa should probably not be done...
        // TODO: Cleaning a field value independent of the location
        if (this.type.fields[key].location ?? "frontmatter" === "frontmatter") {
            return this.accessors.frontmatter.setValue(key, value);
        } else {
            return this.accessors.inline.setValue(key, value);
        }
    }
}

export abstract class BaseFieldAccessor implements IFieldAccessor {
    constructor(public type: Type) { }

    abstract getLines(): Promise<Array<string>>;
    abstract setLine(lineNumber: number, line: string): Promise<void>;
    abstract insertLine(lineNumber: number, line: string): Promise<void>;

    protected skipFrontMatter(lines: Array<string>): number {
        let lineno = 0;
        if (lines[0].trim() === "---") {
            lineno = 1;
            while (lineno < lines.length && lines[lineno].trim() !== "---") {
                lineno++;
            }
            if (lineno == lines.length) {
                lineno = 1;
            } else {
                lineno++;
            }
        }
        return lineno;
    }

    protected locateField(lines: Array<string>, key: string): FieldSearchResult {
        let match;
        for (let lineno = 0; lineno < lines.length; lineno++) {
            let line = lines[lineno];
            if ((match = regexField.exec(line) as FieldSearchResult["match"]) && match.groups.field == key) {
                return { success: true, lineno: lineno, match: match };
            }
        }
        return { success: false };
    }

    async getValue(key: string): Promise<string | null> {
        let lines = await this.getLines();
        let result = this.locateField(lines, key);
        if (result.success) {
            return result.match.groups.value;
        }
        return null;
    }

    findInsertionLine(lines: Array<string>, key: string): number {
        let lineNumber = this.skipFrontMatter(lines);
        lineNumber = this.skipBlankLines(lines, lineNumber);
        lineNumber = this.skipPrecedingFields(lines, lineNumber, key);
        return lineNumber;
    }

    skipBlankLines(lines: Array<string>, lineNumber: number): number {
        while (lineNumber < lines.length && !lines[lineNumber].trim().length) {
            lineNumber++;
        }
        return lineNumber;
    }

    skipPrecedingFields(lines: Array<string>, lineNumber: number, key: string): number {
        let fieldOrder = getFieldOrder(this.type);
        let currentFieldOrder = fieldOrder[key];
        for (; lineNumber < lines.length; lineNumber++) {
            let line = lines[lineNumber];
            let match = regexField.exec(line) as FieldSearchResult["match"];
            if (!match) {
                break;
            }
            let order = fieldOrder[match.groups.field];
            if (order > currentFieldOrder) {
                break;
            }
        }
        return lineNumber;
    }

    async setValue(key: string, value: string): Promise<void> {
        let lines = await this.getLines();
        let result = this.locateField(lines, key);
        let newLine = `${key} :: ${value}`;

        if (result.success) {
            if (!value) {
                // If the next line is blank, remove it.
                if (lines[result.lineno + 1] != null && !lines[result.lineno + 1].trim()) {
                    await this.setLine(result.lineno + 1, "");
                }

                // Remove the field
                await this.setLine(result.lineno, "");
            } else {
                // Update the field value using the abstract setLine method
                await this.setLine(result.lineno, newLine);

                // Ensure there's a blank line after the updated field
                if (
                    lines[result.lineno + 1] &&
                    lines[result.lineno + 1].trim() &&
                    !regexField.test(lines[result.lineno + 1])
                ) {
                    await this.insertLine(result.lineno + 1, "");
                }
            }
        } else {
            if (value) {
                let lineNumber = this.findInsertionLine(lines, key);
                await this.insertLine(lineNumber, newLine);

                // Add a blank line after the newly inserted field
                if (lines[lineNumber] != null && lines[lineNumber].trim() && !regexField.test(lines[lineNumber])) {
                    await this.insertLine(lineNumber + 1, "");
                }
            }
        }
    }
}

class EditorFieldAccessor extends BaseFieldAccessor {
    constructor(public editor: Editor, type: Type) {
        super(type);
    }

    async getLines(): Promise<Array<string>> {
        return Array.from({ length: this.editor.lineCount() }, (_, i) => this.editor.getLine(i));
    }

    async setLine(lineNumber: number, line: string): Promise<void> {
        let oldLine = this.editor.getLine(lineNumber);
        this.editor.replaceRange(line, { line: lineNumber, ch: 0 }, { line: lineNumber, ch: oldLine.length });
    }

    async insertLine(lineNumber: number, line: string): Promise<void> {
        this.editor.replaceRange(line + "\n", { line: lineNumber, ch: 0 });
    }
}

class FileFieldAccessor extends BaseFieldAccessor {
    content?: string;
    lines?: Array<string>;

    constructor(public file: TFile, public plugin: TypingPlugin, type: Type) {
        super(type);
    }

    async getLines(): Promise<Array<string>> {
        if (this.lines) {
            return this.lines;
        }
        this.content = await this.plugin.app.vault.read(this.file);
        this.lines = this.content.split("\n");
        return this.lines;
    }

    async setLine(lineNumber: number, line: string): Promise<void> {
        let lines = await this.getLines();
        if (line) {
            lines[lineNumber] = line;
        } else {
            lines.splice(lineNumber, 1);
        }
        let newContent = lines.join("\n");
        await this.plugin.app.vault.modify(this.file, newContent);
    }

    async insertLine(lineNumber: number, line: string): Promise<void> {
        let lines = await this.getLines();
        lines.splice(lineNumber, 0, line);
        let newContent = lines.join("\n");
        await this.plugin.app.vault.modify(this.file, newContent);
    }
}

export class StringInlineFieldAccessor extends BaseFieldAccessor {
    constructor(public content: string, type: Type) {
        super(type);
    }

    async getLines(): Promise<Array<string>> {
        return this.content.split("\n");
    }

    async setLine(lineNumber: number, line: string): Promise<void> {
        let lines = await this.getLines();
        if (line) {
            lines[lineNumber] = line;
        } else {
            lines.splice(lineNumber, 1);
        }
        this.content = lines.join("\n");
    }

    async insertLine(lineNumber: number, line: string): Promise<void> {
        let lines = await this.getLines();
        lines.splice(lineNumber, 0, line);
        this.content = lines.join("\n");
    }
}

export function autoInlineFieldAccessor(path: string, plugin: TypingPlugin): EditorFieldAccessor | FileFieldAccessor | null {
    let note = gctx.api.note(path);
    let activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView && activeView.getMode() == "source" && activeView.file && activeView.file.path === path && note.type) {
        return new EditorFieldAccessor(activeView.editor, note.type);
    } else {
        let tfile = note.file;
        if (!tfile || !note.type) {
            return null;
        }
        return new FileFieldAccessor(tfile, plugin, note.type);
    }
}

export function autoFieldAccessor(path: string, plugin: TypingPlugin): IFieldAccessor | null {
    let note = gctx.api.note(path);
    if (!note.type) {
        return null;
    }
    let inlineAccessor = autoInlineFieldAccessor(path, plugin);
    if (!inlineAccessor) {
        return null;
    }
    if (!note.file) {
        return inlineAccessor;
    }
    return new FieldDependentFieldAccessor(note.type, {
        frontmatter: new FrontmatterFieldAccessor(note.file, plugin, note.type),
        inline: inlineAccessor
    });
}

function getFieldOrder(type: Type): { [name: string]: number } {
    let result: { [name: string]: number } = {};
    if (!type.fields) {
        return result;
    }
    let index = 0;
    for (let name in type.fields) {
        result[name] = index;
        index++;
    }
    return result;
}
