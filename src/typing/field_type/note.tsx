import { DataArray, Link, Literal, SMarkdownPage } from "obsidian-dataview";
import { Suspense } from "react";
import { gctx } from "src/context";
import { Visitors } from "src/language";
import { Field, Type } from "src/typing";
import { IComboboxOption, Pickers } from "src/ui";
import { field, parseLink, RenderLink } from "src/utilities";
import { FieldType } from "./base";

export class Note extends FieldType<Note> {
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
            this._types = this.typeNames.map((name) => gctx.graph.get({ name })).filter((type) => type != null);
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
                Visitors.String.extend({
                    // TODO: check all types are valid and have folders
                    // TODO: autocomplete
                })
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
            init(args, kwargs) {
                return Note.new({ typeNames: args, ...kwargs });
            },
        });
}
