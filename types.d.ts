import "obsidian";
import { DataviewApi } from "obsidian-dataview";
import { Identifier, StringLiteral } from "@babel/types";

declare module "obsidian" {
    interface App {
        plugins: {
            enabledPlugins: Set<string>;
            plugins: {
                [id: string]: any;
                dataview?: {
                    api?: DataviewApi;
                };
            };
        };
    }
    interface MetadataCache {
        on(name: "typing:schema-change", callback: () => any, ctx?: any): EventRef;
        on(name: "typing:schema-ready", callback: () => any, ctx?: any): EventRef;
        on(name: "dataview:api-ready", callback: (api: DataviewApi) => any, ctx?: any): EventRef;
        on(
            name: "dataview:metadata-change",
            callback: (
                ...args:
                    | [op: "rename", file: TAbstractFile, oldPath: string]
                    | [op: "delete", file: TFile]
                    | [op: "update", file: TFile]
            ) => any,
            ctx?: any
        ): EventRef;
    }
    interface MarkdownPostProcessorContext {
        containerEl?: HTMLElement;
    }
}

declare module "@babel/types" {
    interface ExportAllDeclaration {
        // The type declaration for @babel/types do not match what is generated when
        // parsing `export * as A from "source"`, as evidenced by babel's own tests:
        // https://github.com/babel/babel/blob/64fa46676b5729fcc53fbc71ccd4615d3017fe08/packages/babel-parser/test/fixtures/estree/export/ns-from/output.json
        exported?: StringLiteral | Identifier;
    }
}
