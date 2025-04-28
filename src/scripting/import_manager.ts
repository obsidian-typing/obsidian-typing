import { Fragment, h } from "preact";
import { gctx } from "src/context";
import { FileSpec, LoadedModule, Module, ModuleManagerSync } from "src/utilities/module_manager_sync";
import { CompiledModule, compileModuleWithContext, TranspilationError } from "./transpilation";


export class ImportManager extends ModuleManagerSync<CompiledModule> {
    extensions = ["tsx", "ts", "jsx", "js"];

    protected evaluateModule(file: FileSpec, mod: Module<CompiledModule>): mod is LoadedModule<CompiledModule> {
        let result;
        try {
            result = compileModuleWithContext(
                file.source,
                { api: gctx.api, h, Fragment },
                { transpile: true, filename: "@typing-script///" + file.path }
            );
        } catch (e) {
            mod.error = e.message ?? e;
            return false;
        }

        if (result.message === undefined || result.message === null) {
            mod.env = result as Exclude<typeof result, TranspilationError>;
            return true;
        } else {
            mod.error = result.message;
            return false;
        }
    }

    protected onAfterReload(): void {
        gctx.noteCache.invalidateAll();
        gctx.app.metadataCache.trigger("typing:schema-change");
    }
}
