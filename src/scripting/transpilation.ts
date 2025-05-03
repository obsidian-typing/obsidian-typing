import { PluginItem, PluginObj, TransformOptions } from "@babel/core";
import { availablePlugins, availablePresets, transform } from "@babel/standalone";
import { customImportExportTransform } from "./transform";
import { extname } from "path-browserify";

const presetTypeScript = availablePresets["typescript"];
const transformReactJSX = availablePlugins["transform-react-jsx"];
const transformModulesCommonJS = availablePlugins["transform-modules-commonjs"];

const transpilationModes = ["js", "jsx", "ts", "tsx"] as const
const transpilationTargets = ["module", "function"] as const

export type TranspilationMode = (typeof transpilationModes)[number]
export type TranspilationTarget = (typeof transpilationTargets)[number]

export const DEFAULT_TRANSPILATION_MODE: TranspilationMode = "tsx";
export const TRANSPILATION_MODES: readonly TranspilationMode[] = transpilationModes
export const TRANSPILATION_TARGETS: readonly TranspilationTarget[] = transpilationTargets

function supportsTypeScript(mode: TranspilationMode): boolean {
    return mode === "ts" || mode === "tsx"
}

function supportsReactJSX(mode: TranspilationMode): boolean {
    return mode === "jsx" || mode === "tsx"
}

export interface TranspilationError {
    message: string;
    stack?: string;
}

export type TranspilationResult = {
    code?: undefined;
    errors: Array<TranspilationError>;
} | {
    code: string;
    errors?: undefined;
};

const removeUseStrict: PluginObj = {
    visitor: {
        Directive(path) {
            if (path.node.value.value === "use strict") {
                path.remove();
            }
        },
    },
};

const moduleImportExportTransform: PluginObj = customImportExportTransform({ ctxObject: "api", importFunction: "_import_explicit" });

const functionImportExportTransform: PluginObj = customImportExportTransform({ ctxObject: "__ctx", importFunction: "_import_explicit" });

function getTranspileOptions(target: TranspilationTarget, mode: TranspilationMode): TransformOptions {
    const presets: PluginItem[] = [];

    // TypeScript syntax is only supported in .ts and .tsx files
    if (supportsTypeScript(mode)) {
        presets.push(presetTypeScript);
    }

    const plugins: PluginItem[] = []

    // The context available to script modules and inline functions is different
    if (target === "module") {
        plugins.push(moduleImportExportTransform);
    } else if (target == "function") {
        plugins.push(functionImportExportTransform);
    }

    // JSX syntax is only supported in .jsx and .tsx files
    if (supportsReactJSX(mode)) {
        plugins.push([transformReactJSX, { pragma: "h", pragmaFrag: "Fragment" }]);
    }

    plugins.push(transformModulesCommonJS);

    // TODO: Do we still need to remove "use strict"?
    plugins.push(removeUseStrict);

    return {
        presets,
        plugins,
        parserOpts: {
            allowReturnOutsideFunction: true,
            allowImportExportEverywhere: true,
            // allowAwaitOutsideFunction: true, TODO: do we need it?
        },
        filename: `file.${mode}`,
    };
}

const TRANSPILE_OPTIONS: Record<TranspilationTarget, Record<TranspilationMode, TransformOptions>> = {
    module: {
        js: getTranspileOptions("module", "js"),
        jsx: getTranspileOptions("module", "jsx"),
        ts: getTranspileOptions("module", "ts"),
        tsx: getTranspileOptions("module", "tsx"),
    },
    function: {
        js: getTranspileOptions("function", "js"),
        jsx: getTranspileOptions("function", "jsx"),
        ts: getTranspileOptions("function", "ts"),
        tsx: getTranspileOptions("function", "tsx"),
    }
}

export function transpile(source: string, options: TransformOptions): TranspilationResult {
    try {
        let result = transform(source, options);
        if (result.code === null || result.code === undefined) {
            throw new Error("Transpilation failed to produce a result");
        }
        return { code: result.code };
    } catch (e) {
        return {
            errors: [{ message: e.message, stack: e.stack }],
        };
    }
}

export function transpileModule(source: string, options: { mode?: TranspilationMode, filename?: string } = {}) {
    let baseOptions = getTranspileOptions(
        "module",
        options.mode ??  DEFAULT_TRANSPILATION_MODE
    );
    return transpile(source, {
        ...baseOptions,
        filename: options.filename ?? baseOptions.filename,
    });
}

export function transpileFunction(source: string, options: { mode?: TranspilationMode, filename?: string } = {}) {
    let baseOptions = getTranspileOptions(
        "function",
        options.mode ??  DEFAULT_TRANSPILATION_MODE
    );
    return transpile(source, {
        ...baseOptions,
        filename: options.filename ?? baseOptions.filename,
    });
}

export type CompiledModule = {
    exports: Record<string, any>;
}

export function compileModuleWithContext(
    code: string,
    context: Record<string, any> = {},
    options: { transpile: boolean | TranspilationMode; filename?: string } = { transpile: true }
): CompiledModule & { message?: undefined } | TranspilationError {
    if (options.transpile) {
        let mode = typeof options.transpile === "boolean" ? undefined : options.transpile;
        let transpiled = transpileModule(code, { mode, filename: options.filename });
        if (transpiled.errors != null) {
            return transpiled.errors[0];
        }
        code = transpiled.code;
    }

    const exports = {};
    const module = { exports };

    const contextNames = Object.keys(context);

    // Use Function constructor to create a function
    const createModule = new Function(
        "exports",
        "module",
        ...contextNames,
        `${code}\n//# sourceURL=${options.filename}`
    );

    // Run the function to populate the exports object
    createModule(exports, module, ...contextNames.map((name) => context[name]));

    return { exports: { ...exports, ...module.exports } };
}

export function compileFunctionWithContext(
    code: string,
    context: Record<string, any> = {},
    args: string[] = ["ctx", "note"],
    options: { transpile: boolean | TranspilationMode, filename?: string } = { transpile: true }
): Function & { message?: undefined } | TranspilationError {
    if (options.transpile) {
        let mode = typeof options.transpile === "boolean" ? undefined : options.transpile;
        let transpiled = transpileFunction(code, { mode, filename: options.filename });
        if (transpiled.errors) {
            return transpiled.errors[0];
        }
        code = transpiled.code;
    }

    if (code && options.filename) {
        code = `${code}\n//# sourceURL=${options.filename}`;
    }

    const contextNames = Object.keys(context);

    const fn = new Function(...contextNames, ...args, code);

    try {
        return partial(fn, ...contextNames.map((name) => context[name]));
    } catch (e) {
        return { message: e.message };
    }
}

function partial(fn: Function, ...args: any[]) {
    return function (...newArgs: any[]) {
        return fn.apply(null, args.concat(newArgs));
    };
}
