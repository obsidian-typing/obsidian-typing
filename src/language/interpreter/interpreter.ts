import { gctx } from "src/context";
import { parser } from "src/language/grammar/otl_parser";
import { TVisitorBase, Visitors } from "src/language/visitors";
import { Type } from "src/typing";
import { FilePath, FileSpec, LoadedModule, Module, ModuleManagerSync } from "src/utilities/module_manager_sync";

export type SchemaModule = {
    types: Record<string, Type>;
}

export class Interpreter extends ModuleManagerSync<SchemaModule> {
    extensions = ["otl"];

    public runCode(code: string, visitor: TVisitorBase) {
        let tree = parser.parse(code);
        let node = tree.topNode;
        if (!node) return null;

        let lint = visitor.lint(node, { interpreter: this, input: code });
        if (lint.hasErrors) return null;

        return visitor.run(node, { interpreter: this, input: code });
    }

    public evaluateModule(file: FileSpec, mod: Module<SchemaModule>): mod is LoadedModule<SchemaModule> {
        if (file.source === null || file.source === undefined) {
            return false;
        }

        // Parse text into AST
        let tree = parser.parse(file.source);

        // Check for lint errors
        let lint = Visitors.File.lint(tree.topNode, { interpreter: this });
        if (lint.hasErrors) {
            mod.error = lint.diagnostics.map((d) => `${file.path}:${d.from}-${d.to}: ${d.message}`).join("\n");
        }

        // Convert AST into our object model
        let types = Visitors.File.run(tree.topNode, { interpreter: this });
        if (types === null) {
            return false;
        }

        mod.env = { types };
        return true;
    }

    protected onAfterImport(path: FilePath): void {
        if (path === gctx.plugin.settings.schemaPath) {
            gctx.types.clear();
            let newModule = this.modules[path];
            let newTypes = newModule.env?.types;
            for (let key in newTypes) {
                gctx.types.add(newTypes[key]);
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
