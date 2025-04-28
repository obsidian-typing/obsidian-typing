import { PluginItem, PluginObj, TransformOptions } from "@babel/core";
import { availablePlugins, availablePresets, transform } from "@babel/standalone";
import { customImportExportTransform } from "./transform";

const presetTypeScript = availablePresets["typescript"];
const transformReactJSX = availablePlugins["transform-react-jsx"];
const transformModulesCommonJS = availablePlugins["transform-modules-commonjs"];

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

const DEFAULT_PLUGINS: PluginItem[] = [
    [transformReactJSX, { pragma: "h", pragmaFrag: "Fragment" }],
    transformModulesCommonJS,
    removeUseStrict,
];

const DEFAULT_PARSER_OPTS: TransformOptions["parserOpts"] = {
    allowReturnOutsideFunction: true,
    allowImportExportEverywhere: true,
    // allowAwaitOutsideFunction: true, TODO: do we need it?
};

const DEFAULT_TRANSPILE_OPTIONS: TransformOptions = {
    presets: [presetTypeScript],
    plugins: [
        customImportExportTransform({ ctxObject: "api", importFunction: "_import_explicit" }),
        ...DEFAULT_PLUGINS,
    ],
    parserOpts: DEFAULT_PARSER_OPTS,
    filename: "file.tsx",
};

const MODULE_TRANSPILE_OPTIONS: TransformOptions = DEFAULT_TRANSPILE_OPTIONS;

const FUNCTION_TRANSPILE_OPTIONS: TransformOptions = {
    presets: [presetTypeScript],
    plugins: [
        customImportExportTransform({ ctxObject: "__ctx", importFunction: "_import_explicit" }),
        ...DEFAULT_PLUGINS,
    ],
    parserOpts: DEFAULT_PARSER_OPTS,
    filename: "file.tsx",
};

export function transpile(source: string, options: TransformOptions = DEFAULT_TRANSPILE_OPTIONS): TranspilationResult {
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

export function transpileModule(source: string, options: { filename?: string } = {}) {
    return transpile(source, { ...MODULE_TRANSPILE_OPTIONS, ...options });
}

export function transpileFunction(source: string, options: { filename?: string } = {}) {
    return transpile(source, { ...FUNCTION_TRANSPILE_OPTIONS, ...options });
}

export function compileModuleWithContext(
    code: string,
    context: Record<string, any> = {},
    options: { transpile: boolean; filename?: string } = { transpile: true }
): Record<string, any> {
    if (options.transpile) {
        let transpiled = transpileModule(code, { filename: options.filename ?? "file.tsx" });
        if (transpiled.errors != null) {
            throw transpiled.errors[0];
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

    const result = { ...exports, ...module.exports };

    return result;
}

export function compileFunctionWithContext(
    code: string,
    context: Record<string, any> = {},
    args: string[] = ["ctx", "note"],
    options: { transpile: boolean, filename?: string } = { transpile: true }
): Function | TranspilationError {
    if (options.transpile) {
        let transpiled = transpileFunction(code, { filename: options.filename ?? "file.tsx" });
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
