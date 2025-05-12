import { TFile, TFolder } from "obsidian";
import { gctx } from "src/context";
import { StringInlineFieldAccessor } from "src/middleware/field_accessor";
import { Prompt, PromptState } from "src/ui";
import { DataClass, field, mergeDeep } from "src/utilities";
import { Action, Field, FieldTypes, Hook, HookContainer, HookContextType, HookNames, Method, Note, NoteState, Prefix, Style } from ".";
import { OnValidateHookContext } from "./hook";
import { LinkResolutionContext, ValidationContext, ValidationResult } from "src/validation";
import { FieldPath } from "src/validation/reporting";
import { compositeSource, objectSource } from "src/validation/sources";

export class Type extends DataClass {
    @field({ inherit: false })
    public isAbstract: boolean = false;

    @field()
    public name!: string;

    get displayName(): string {
        return this.title || this.name;
    }

    @field()
    public parentNames: Array<string> = [];

    @field({ inherit: false })
    public parents: Array<Type> = [];

    @field({ required: false, inherit: false })
    public title?: string;

    @field({ required: false, inherit: false })
    public description?: string;

    @field({ required: false, inherit: false })
    public category?: string;

    @field({ required: false, inherit: false })
    public folder?: string;

    @field({ required: false, inherit: false })
    public glob?: string | null = null;

    @field({ required: false })
    public icon?: string;

    @field({ required: false })
    public prefix?: Prefix;

    @field()
    public style: Style = Style.new();

    @field({ inherit: (a, b) => ({ ...b, ...a }) })
    public fields: Record<string, Field> = {};

    @field({ inherit: (a, b) => ({ ...b, ...a }) })
    public actions: Record<string, Action> = {};

    @field({ inherit: (a, b) => ({ ...b, ...a }) })
    public methods: Record<string, Method> = {};

    @field()
    public hooks: HookContainer = HookContainer.new();

    private ancestors: Record<string, Type> = {};
    private descendants: Record<string, Type> = {};

    public onAfterCreate(): void {
        this.rebindFields();
    }

    public onAfterInherit(): void {
        this.rebindFields();
        this.indexAncestors();
    }

    rebindFields() {
        for (let key in this.fields) {
            this.fields[key] = this.fields[key].bind({ type: this });
        }
    }

    indexAncestors(type?: Type) {
        type = type ?? this;
        for (let parent of type.parents) {
            this.ancestors[parent.name] = parent;
            parent.descendants[this.name] = this;
            this.indexAncestors(parent);
        }
    }

    async runHook<T extends HookNames>(name: T, context: HookContextType<T>) {
        this.hooks.run(name, context);
    }

    async runValidation(note: Note): Promise<ValidationResult> {
        let validationContext: ValidationContext & LinkResolutionContext = new ValidationContext();
        let rootPath = FieldPath.new();
        if (!note.fields) {
            throw new Error("Internal Error: Note.fields must be set");
        }
        let rootData = compositeSource(objectSource(note.fields, validationContext));

        // TODO: The detection of required fields is currently a hack
        let presentFields = new Set(rootData.keys()) as Set<string>;
        let expectedFields = new Set(Object.values(this.fields).map(field => field.name));
        let requiredFields = new Set(Object.values(this.fields).filter(field => field.type instanceof FieldTypes.Required).map(field => field.name));

        let knownFields = presentFields.intersection(expectedFields);
        let unknownFields = presentFields.difference(expectedFields);
        let missingFields = requiredFields.difference(presentFields);

        for (let known in knownFields) {
            let fieldTarget = rootData.field(known);
            let fieldDefinition = this.fields[known]!;
            fieldDefinition.type.validate(fieldTarget);
        }

        for (let unexpected of unknownFields) {
            rootData.field(unexpected as any).report({
                level: "error",
                message: `Field ${unexpected} was not expected. Only known fields are allowed.`
            })
        }

        for (let missing of missingFields) {
            validationContext.report({
                level: "error",
                message: `Field ${missing} is required but not present.`,
                // There is no concrete textual location to associate
                // with a missing field (after all, it is missing).
                // Report it at the end of the frontmatter instead.
                // TODO: Report at correct location
                location: {
                    path: rootPath.field(missing),
                    span: {
                        start: 0,
                        end: 0,
                        length: 0,
                        relativeTo: undefined as unknown
                    }
                }
            })
        }

        let hookContext: OnValidateHookContext = {
            note,
            fields: rootData,
        }
        await this.runHook(HookNames.ON_VALIDATE, hookContext);

        let validationResult = validationContext.toResult();
        if (validationResult.ok) {
            console.log(`[OK] Validation succeeded. ${validationResult.messages.length} messages.`, validationResult.messages);
        } else {
            console.log(`[ERROR] Validation failed. ${validationResult.messages.length} messages.`, validationResult.messages);
        }

        return validationResult;
    }

    async promptNew(initialState?: Partial<NoteState>) {
        initialState = initialState ?? {};

        let defaults: Record<string, string> = {};
        for (let fieldName in this.fields) {
            defaults[fieldName] = this.fields[fieldName].default;
        }
        let state = mergeDeep({ type: this, fields: defaults }, initialState) as PromptState;

        if (this.hooks.has(HookNames.CREATE)) {
            this.runHook(HookNames.CREATE, { type: this, state });
            return;
        }

        state = await gctx.api.prompt(
            <Prompt submitText={`Create new ${this.name}`} noteState={state}>
                <Prompt.Title />
                <Prompt.Text />
                <Prompt.Fields />
            </Prompt>,
            { confirmation: true }
        );
        return state;
    }

    async create(stateFactory: Omit<NoteState, "type"> | Promise<Omit<NoteState, "type"> | null | undefined> | null | undefined) {
        let state = await stateFactory;
        if (!state) {
            return;
        }
        let content = state.text ?? "";
        if (state.fields) {
            let fieldAccessor = new StringInlineFieldAccessor(content, this);
            for (let key in state.fields) {
                await fieldAccessor.setValue(key, state.fields[key]);
            }
            content = fieldAccessor.content;
        }

        // TODO: generate prefix from `cdate` to have them in sync
        let fullname = `${state.prefix ?? ""} ${state.title ?? ""}`.trim();
        let path = `${this.folder}/${fullname}.md`;

        let vault = gctx.app.vault;
        if (this.folder && !vault.getAbstractFileByPath(this.folder)) {
            await vault.createFolder(this.folder);
        }

        await gctx.app.vault.create(path, content);

        let note = Note.new(path);
        note.runHook(HookNames.ON_CREATE, { note });
        return note;
    }

    get isCreateable() {
        return this.folder != null;
    }

    async getAllNotes(options?: { withSubtypes?: boolean }): Promise<Note[]> {
        const getNotePathsOfType = async (type: Type) => {
            if (gctx.dv !== null) {
                let queryString;
                if (type.folder) {
                    queryString = `LIST WHERE choice(_type, _type = "${type.name}", file.folder = "${type.folder}")`;
                } else {
                    queryString = `LIST WHERE _type = "${type.name}"`;
                }
                return (await gctx.dv.tryQuery(queryString)).values as string[];
            } else if (this.folder) {
                let folder = gctx.app.vault.getAbstractFileByPath(this.folder);
                if (folder === null) {
                    return [];
                }
                if (!(folder instanceof TFolder)) {
                    throw new Error("Specified type folder is a file");
                }
                return folder.children.filter((x) => x instanceof TFile && x.extension == "md").map((x) => x.path);
            } else {
                return [];
            }
        };

        let paths: string[];
        if (options?.withSubtypes) {
            let pathSet = new Set<string>();
            for (let type of [this, ...Object.values(this.descendants)]) {
                (await getNotePathsOfType(type)).forEach(item => pathSet.add(item));
            }
            paths = [...pathSet];
        } else {
            paths = await getNotePathsOfType(this);
        }

        return [...paths].map((path) => Note.new(path, { type: this }));
    }

    getAncestor(name: string): Type | null {
        return this.ancestors[name];
    }

    isAncestorOf(other: Type): boolean {
        return !!other.ancestors[this.name];
    }

    isDescendantOf(other: Type): boolean {
        return !!this.ancestors[other.name];
    }
}
