import { Fragment, h } from "preact";
import { gctx } from "src/context";
import { Note } from "src/typing";
import { DataClass, field } from "src/utilities";
import { compileFunctionWithContext, TranspilationMode } from "./transpilation";

export interface IScriptContextBase {
    note?: Note;
    _import_explicit?: typeof gctx.api._import_explicit;
}

export class Script<T extends IScriptContextBase = IScriptContextBase> extends DataClass {
    @field({ required: true })
    source!: string;

    fn!: Function;

    @field()
    mode?: string | null;

    @field()
    filePath?: string | null;

    onAfterCreate() {
        this.source = this.transformSource(this.source);
        let transpiled = compileFunctionWithContext(this.source, { h, Fragment, api: gctx.api }, [
            "ctx",
            "note",
            "__ctx",
        ]);
        if (transpiled instanceof Function) {
            this.fn = transpiled;
        } else {
            throw transpiled;
        }
    }

    transformSource(source: string) {
        return source;
    }

    call(ctx: T) {
        ctx._import_explicit = (path: string, symbols: (string | symbol | number)[]) =>
            gctx.api._import_explicit(path, symbols, this.filePath ?? undefined);
        return this.fn(ctx, ctx.note, ctx);
    }

    static validate(mode: TranspilationMode, source: string) {
        if (!gctx.settings.enableScripting) {
            return { message: "Safe mode: JS scripting is currently disabled. Please enable it in Typing settings." };
        }
        let transformedSource = this.prototype.transformSource(source);
        let result = compileFunctionWithContext(transformedSource, {}, undefined, { transpile: mode ?? true });
        if (result instanceof Function) {
            return {};
        }
        return { message: result.message };
    }
}

export class FnScript<T extends IScriptContextBase = IScriptContextBase> extends Script<T> {}

export class ExprScript<T extends IScriptContextBase = IScriptContextBase> extends Script<T> {
    transformSource(source: string) {
        return `return (${source})`;
    }
}
