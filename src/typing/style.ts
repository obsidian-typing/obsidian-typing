import { FnScript, IScriptContextBase } from "src/scripting";
import { DataClass, field } from "src/utilities";
import { Values } from ".";

export enum ShowPrefixValues {
    ALWAYS = "always",
    SMART = "smart",
    NEVER = "never",
}

export enum HideInlineFieldsValues {
    ALL = "all",
    NONE = "none",
    DEFINED = "defined",
}

export interface ILinkScriptContext extends IScriptContextBase {
    container?: HTMLElement;
    linkText?: string;
    props?: {};
}

export class Style extends DataClass {
    @field()
    public link?: FnScript<ILinkScriptContext> | null = null;
    @field()
    public header?: FnScript | Values.Markdown | null = null;
    @field()
    public footer?: FnScript | Values.Markdown | null = null;
    @field()
    public show_prefix: ShowPrefixValues = ShowPrefixValues.SMART;
    @field()
    public hide_inline_fields: HideInlineFieldsValues | null = null;
    @field()
    public css_classes: Array<string> | null = null;
    @field()
    public css: string | null = null;
}
