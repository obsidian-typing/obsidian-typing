import { Reference } from "obsidian";
import { DataArray, Link, Literal, SMarkdownPage } from "obsidian-dataview";
import { Suspense } from "react";
import { gctx } from "src/context";
import { Visitors } from "src/language";
import { Field, Note as NoteObject, Type } from "src/typing";
import { IComboboxOption, Pickers } from "src/ui";
import { ParsedLink, field, parseLink, RenderLink } from "src/utilities";
import { LinkResolutionContext, report, TypedValidator, Validation } from "src/validation";
import { FieldType } from "./base";

export class Note extends FieldType<Note> implements TypedValidator<string | ParsedLink | Link | Reference> {
    name = "Note";

    static requiresDataview = true;

    @field()
    public typeNames: Array<string> = [];

    private _types?: Array<Type>;
    private _inverseFields?: Record<string, Field>;

    @field({ required: false })
    public dv?: string;

    @field({ required: false })
    public short: boolean = true;

    @field({ required: false })
    public subpath: boolean = false;

    @field({ required: false })
    public display: boolean = false;

    @field({ required: false })
    public subtypes: boolean = false;

    @field({ required: false })
    public relation: boolean = false;

    @field({ required: false })
    public implicit: boolean = false;

    @field({ required: false })
    public explicit: boolean = false;

    @field({ required: false })
    public inverse?: string;

    get types() {
        if (!this._types) {
            this._types = this.typeNames.map((name) => gctx.types.get({ name })).filter((type) => type != null);
        }
        return this._types;
    }

    get inverseFields() {
        if (!this._inverseFields) {
            this._inverseFields = {};

            const fields = this._inverseFields;
            const fieldName = this.inverse;

            if (fieldName) {
                this.types.forEach((type) => {
                    const field = type.fields[fieldName];
                    if (field) {
                        fields[type.name] = field;
                    }
                });
            }
        }
        return this._inverseFields;
    }

    get isImplicit() {
        return this.implicit;
    }

    get isExplicit() {
        // "explicit" defaults to false if "implicit=true" was set by the user
        return this.explicit || !this.implicit;
    }

    validate(target: Validation.Target<unknown>): void | Promise<void> {
        return this.validateTyped(target as any);
    }

    validateTyped(target: Validation.Target<string | ParsedLink | Link | Reference>): void | Promise<void> {
        if (typeof target.value === "string") {
            let link = parseLink(target.value, false);
            if (link) {
                return this.validateTyped(target.asTyped(link));
            }
        } else if (typeof target.value === "object") {
            if ("path" in target.value) { // ParsedLink | obsidian-dataview.Link
                return this.validateLinkPath(target.asTyped(target.value.path));
            } else if ("link" in target.value) { // obsidian.Reference
                return this.validateLinkPath(target.asTyped(target.value.link));
            }
        }

        report(target, {
            message: `Field ${target.path} must be a link`
        });
    }

    async validateLinkPath(target: Validation.Target<string>): Promise<void> {
        // ParsedLink
        var sourcePath = (target.context as LinkResolutionContext)?.sourcePath ?? "";
        let targetNote = NoteObject.fromLink(target.value, sourcePath);
        if (!targetNote) {
            target.report({
                level: "warning",
                message: `Field ${target.path} contains a link to a non-existent note.`,
            })
        } else if (!targetNote.type) {
            if (this.types.length > 0) {
                target.report({
                    level: "warning",
                    message: `Field ${target.path} contains a link to an untyped note.`,
                })
            }
        } else if (this.subtypes) {
            if (!this.types.some(t => t.isAncestorOf(targetNote.type!))) {
                target.report({
                    level: "error",
                    // TODO: Adapt message singular <=> plural depending on presence of FieldTypes.List
                    message:
                        `Field ${target.path} must only contain links to notes ` +
                        `of the following types or their subtypes: ${this.typeNames.join(", ")}`,
                })
            }
        } else {
            if (!this.typeNames.includes(targetNote.type!.name)) {
                target.report({
                    level: "error",
                    // TODO: Adapt message singular <=> plural depending on presence of FieldTypes.List
                    message:
                        `Field ${target.path} must only contain links to notes ` +
                        `of the following types or their subtypes: ${this.typeNames.join(", ")}`,
                })
            }
        }
    }

    Display: FieldType["Display"] = ({ value }: { value: Link | string }) => {
        if (typeof value !== "string") value = value.markdown();
        let { path, display }: { path: string, display?: string } = parseLink(value);
        if (!display) {
            // to not pass empty linkText to RenderLink
            display = undefined;
        }

        // TODO: supply current path: which one should it be?
        let resolved = gctx.app.metadataCache.getFirstLinkpathDest(path, "");
        path = resolved?.path ?? path;
        let note = gctx.api.note(path);
        return (
            <a class="internal-link" href={note.path} tabIndex={-1}>
                <Suspense fallback={note.title}>
                    <RenderLink type={note.type} note={note} container={undefined} linkText={display} />
                </Suspense>
            </a>
        );
    };

    Picker = () => {
        const preview = (value: string) => <this.Display value={value} />;

        let options: IComboboxOption[] = Array.from(
            (gctx.dv.pages(this.query) as DataArray<Record<string, Literal> & SMarkdownPage>).map(
                (p): IComboboxOption => ({
                    value: this.short ? p.file.name : p.file.path,
                    label: p.file.name,
                    display: preview,
                })
            )
        );
        return <Pickers.Note options={options} subpath={this.subpath} display={this.display} preview={preview} />;
    };

    get default() {
        return "";
    }

    private get query() {
        return this.types
            .filter((type) => type?.folder != null)
            .map((type) => `"${type.folder}"`)
            .join("|");
    }

    get isRelation() {
        return this.relation;
    }

    static ParametersVisitor = () =>
        Visitors.ParametersVisitorFactory({
            args: Visitors.Literal(
                Visitors.String.extend(base => ({
                    // TODO: check all types are valid and have folders
                    // TODO: autocomplete
                }))
            ),
            kwargs: {
                dv: Visitors.Literal(Visitors.String),
                subpath: Visitors.Literal(Visitors.Boolean),
                display: Visitors.Literal(Visitors.Boolean),
                short: Visitors.Literal(Visitors.Boolean),
                subtypes: Visitors.Literal(Visitors.Boolean),
                relation: Visitors.Literal(Visitors.Boolean),
                implicit: Visitors.Literal(Visitors.Boolean),
                explicit: Visitors.Literal(Visitors.Boolean),
                inverse: Visitors.Literal(Visitors.String),
            },
            lint(args, kwargs) {
                let typeNames = args.map(x => x.value);
                let types = typeNames.map((name) => gctx.types.get({ name })).filter((type) => type != null);
                let inverse = kwargs.inverse?.value;

                if (!inverse) {
                    return;
                }

                let typesWithField: typeof types = [];
                let typesWithoutField: typeof types = [];
                types.forEach((typ) => (typ.fields[inverse] ? typesWithField : typesWithoutField).push(typ))

                if (typesWithoutField.length > 0) {
                    this.error(`Field '${inverse}' does not exist in the following types: ${typesWithoutField.map(t => t.name).join(", ")}`)
                }
            },
            init(args, kwargs) {
                return Note.new({ typeNames: args, ...kwargs });
            },
        });
}
