import { snippetCompletion } from "@codemirror/autocomplete";
import { gctx } from "src/context";
import { DEFAULT_TRANSPILATION_MODE, ExprScript, FnScript, TRANSPILATION_MODES, TranspilationMode } from "src/scripting";
import { Values } from "src/typing";
import { dedent, ifInArray } from "src/utilities";
import * as Visitors from ".";
import { createVisitor, Rules } from "../index_base";

export const FN_SCRIPT_TAGS = [
    ...["fn", "function"],
    ...TRANSPILATION_MODES,
    ...TRANSPILATION_MODES.flatMap(mode => ["fn", "function"].map(kind => `${kind}.${mode}`)),
];

export const FN_SCRIPT_MODES = Object.fromEntries(FN_SCRIPT_TAGS.map(tag => [tag, getModeFromTag(tag)]));

export const EXPR_SCRIPT_TAGS = [
    ...["expr", "expression"],
    ...TRANSPILATION_MODES.flatMap(mode => ["expr", "expression"].map(kind => `${kind}.${mode}`)),
];

export const EXPR_SCRIPT_MODES = Object.fromEntries(FN_SCRIPT_TAGS.map(tag => [tag, getModeFromTag(tag)]));

function getModeFromTag(tag: string | undefined | null): TranspilationMode {
    if (tag === undefined || tag === null) {
        return DEFAULT_TRANSPILATION_MODE;
    }
    return ifInArray(tag.split(".", 2)[1], TRANSPILATION_MODES) ?? DEFAULT_TRANSPILATION_MODE;
}

export const Tag = () => createVisitor({
    rules: Rules.Tag,
    run(node) {
        let text = "";
        let cursor = node.cursor();
        if (cursor.firstChild()) {
            do {
                if (cursor.node.name === Rules.Identifier || cursor.node.name === Rules.Dot) {
                    text += this.getNodeText(cursor.node);
                }
            } while (cursor.nextSibling());
        }
        return text;
    },
});

export const TaggedString = ({ tags, strict = false }: { tags: string[]; strict?: boolean }) =>
    createVisitor({
        rules: Rules.TaggedString,
        children: {
            tag: Visitors.Tag(),
            code: Visitors.String,
        },
        utils: {
            run() {
                let { tag, code } = this.runChildren();
                tag = tag ?? "";
                code = dedent(code ?? "");
                return { tag, code };
            },
        },
        run(node) {
            return this.utils.run();
        },
        accept(node) {
            if (!strict) return true;
            let nodeTag = node.getChild(Rules.Tag);
            if (!nodeTag) return false;
            return tags.contains(this.getNodeText(nodeTag));
        },
        lint(node) {
            let nodeTag = node.getChild(Rules.Tag);
            if (!nodeTag) return;
            let tag = this.getNodeText(nodeTag);

            if (!tags.contains(tag)) {
                this.error(`Invalid tag: ${tag}, allowed tags: ${tags}`, nodeTag);
            }
        },
        snippets() {
            return [
                ...tags.map((x) =>
                    snippetCompletion(x + '"""\n\t${}\n"""', {
                        label: x + '"""..."""',
                        info: "multiline string",

                        detail: "tagged string",
                    })
                ),
                ...tags.map((x) =>
                    snippetCompletion(x + '"${}"', {
                        label: x + '"..."',
                        info: "string",

                        detail: "tagged string",
                    })
                ),
            ];
        },
    });

export const FnScriptString = (content = "\n\t${}\n", tags = FN_SCRIPT_TAGS) =>
    TaggedString({ tags, strict: true }).override(base => ({
        run(node) {
            if (!gctx.settings.enableScripting) return undefined;
            let { tag, code } = this.utils.run();
            return FnScript.new({
                mode: getModeFromTag(tag),
                source: code,
                filePath: this.globalContext?.callContext?.interpreter?.activeModule?.file?.path,
            });
        },
        lint(node) {
            let { tag, code } = this.utils.run();
            let result = FnScript.validate(getModeFromTag(tag), code ?? "");
            if (!gctx.settings.enableScripting) {
                this.warning(
                    "Safe mode: JS scripting is currently disabled. Until you enable it in the plugin settings, this expression will be ignored.",
                    node.getChild(Rules.Tag)
                );
                return;
            }
            if (result.message) {
                this.error(result.message, node.getChild(Rules.Tag));
            }
        },
        snippets() {
            return [
                ...tags.map((x) =>
                    snippetCompletion(x + `"""${content}"""`, {
                        label: x + `"""${content}"""`.replace("${}", "..."),
                        info: "Function script",
                        detail: "tagged string",
                    })
                ),
            ];
        },
    }));


export const ExprScriptString = (content = "\n\t${}\n", tags = EXPR_SCRIPT_TAGS) =>
    TaggedString({ tags, strict: true }).override(base => ({
        run(node) {
            if (!gctx.settings.enableScripting) return undefined;
            let { tag, code } = this.utils.run();
            return ExprScript.new({
                mode: getModeFromTag(tag),
                source: code,
                filePath: this.globalContext?.callContext?.interpreter?.activeModule?.file?.path,
            });
        },
        lint(node) {
            let { tag, code } = this.utils.run();
            let result = ExprScript.validate(getModeFromTag(tag), code ?? "");
            if (!gctx.settings.enableScripting) {
                this.warning(
                    "Safe mode: JS scripting is currently disabled. Until you enable it in the plugin settings, this expression will be ignored.",
                    node.getChild(Rules.Tag)
                );
                return;
            }
            if (result.message) {
                this.error(result.message, node.getChild(Rules.Tag));
            }
        },
        snippets() {
            return [
                ...tags.map((x) =>
                    snippetCompletion(x + `"""${content}"""`, {
                        label: x + `"""${content}"""`.replace("${}", "..."),
                        info: "Function script",
                        detail: "tagged string",
                    })
                ),
            ];
        },
    }));

export const MarkdownString = (tags = ["md", "markdown"]) =>
    TaggedString({ tags, strict: true }).override(base => ({
        run(node) {
            let { code } = this.utils.run();
            return new Values.Markdown(code);
        },
        snippets() {
            return [
                ...tags.map((x) =>
                    snippetCompletion(x + '"""${}"""', {
                        label: x + '""" ... """',
                        info: "Markdown string",
                        detail: "tagged string",
                    })
                ),
            ];
        },
    }));

export const CSSString = (tags = ["css"]) =>
    TaggedString({ tags, strict: true }).override(base => ({
        run(node) {
            return this.utils.run().code;
        },
        snippets() {
            return [
                ...tags.map((x) =>
                    snippetCompletion(x + '"""${}"""', {
                        label: x + '""" ... """',
                        info: "Markdown string",
                        detail: "tagged string",
                    })
                ),
            ];
        },
    }));
