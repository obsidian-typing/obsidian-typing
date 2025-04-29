import { Plugin, Vault } from "obsidian";
import { gctx } from "src/context";
import { parser } from "src/language/grammar/otl_parser";
import { TVisitorBase, Visitors } from "src/language/visitors";
import { Type } from "src/typing";
import { FilePath, FileSpec, LoadedModule, Module, ModuleManagerSync } from "src/utilities/module_manager_sync";

export interface ImportStatusListener {
    onImportStarted(path: FilePath): void;
    onImportFailed(path: FilePath): void;
    onImportCompleted(path: FilePath): void;
}

export type SchemaModule = Record<string, Type>;

export class Interpreter extends ModuleManagerSync<SchemaModule> {
    extensions = ["otl"];

    constructor(
        vault: Vault,
        plugin: Plugin,
        public readonly statusReport?: ImportStatusListener
    ) {
        super(vault, plugin);
    }

    public runCode(code: string, visitor: TVisitorBase) {
        let tree = parser.parse(code);
        let node = tree.topNode;
        if (!node) return null;

        let lint = visitor.lint(node, { interpreter: this, input: code });
        if (lint.hasErrors) return null;

        return visitor.run(node, { interpreter: this, input: code });
    }

    public evaluateModule(file: FileSpec, mod: Module<SchemaModule>): mod is LoadedModule<SchemaModule> {
        let path = this.activeModule?.file.path ?? file.path;

        if (file.source === null || file.source === undefined) {
            this.statusReport?.onImportFailed(path);
            return false;
        }

        this.statusReport?.onImportStarted(path);;
        let tree = parser.parse(file.source);

        let lint = Visitors.File.lint(tree.topNode, { interpreter: this });
        if (lint.hasErrors) {
            mod.error = lint.diagnostics.map((d) => `${file.path}:${d.from}-${d.to}: ${d.message}`).join("\n");
        }
        let types = Visitors.File.run(tree.topNode, { interpreter: this });

        if (types === null) {
            this.statusReport?.onImportFailed(path);
            return false;
        }
        mod.env = types;
        this.statusReport?.onImportCompleted(path);
        return true;
    }

    protected onAfterImport(fileName: string): void {
        if (fileName === gctx.plugin.settings.schemaPath) {
            gctx.types.clear();
            let mainModule = this.modules[fileName];
            for (let key in mainModule.env) {
                gctx.types.add(mainModule.env[key]);
            }
            gctx.noteCache.invalidateAll();
            gctx.app.metadataCache.trigger("typing:schema-change");
        }
    }

    protected onAfterPreload(): void {
        this.importModule(gctx.plugin.settings.schemaPath, undefined, true);
        gctx.types.isReady = true;
        gctx.noteCache.invalidateAll();
        gctx.app.metadataCache.trigger("typing:schema-ready");
    }
}
