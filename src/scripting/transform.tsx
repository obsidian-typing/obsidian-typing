import { NodePath, PluginObj } from "@babel/core";
import {
    ArrayExpression,
    CallExpression,
    ExportAllDeclaration,
    ExportNamedDeclaration,
    ExportSpecifier,
    Identifier,
    ImportDeclaration,
    ImportSpecifier,
    Node,
    ObjectProperty,
    StringLiteral,
    VariableDeclaration
} from "@babel/types";

interface TranspilationOptions {
    ctxObject: string;
    importFunction: string;
}

declare module "@babel/types" {
    interface ExportSpecifier {
        imported?: undefined;
    }
    interface ExportDefaultSpecifier {
        local?: undefined;
    }
    interface ExportNamespaceSpecifier {
        local?: undefined;
    }
    interface ImportSpecifier {
        exported?: undefined;
    }
}

function getText(expr: StringLiteral | Identifier): string {
    return expr.type === "StringLiteral" ? expr.value : expr.name;
}

function getExternalName(specifier: ImportSpecifier | ExportSpecifier): string {
    return getText(specifier.type === "ImportSpecifier" ? specifier.imported : specifier.exported);
}

function buildImportArgs(
    path: NodePath<ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration>
): [StringLiteral, ArrayExpression] {
    if (path.node.type === "ExportAllDeclaration") {
        return [
            { type: "StringLiteral", value: path.node.source.value },
            { type: "ArrayExpression", elements: [{ type: "StringLiteral", value: "__star__" }] },
        ];
    }

    return [
        { type: "StringLiteral", value: path.node.source.value },
        {
            type: "ArrayExpression",
            elements: path.node.specifiers.map((specifier) => {
                if (specifier.type === "ImportSpecifier" || specifier.type === "ExportSpecifier") {
                    return {
                        type: "StringLiteral",
                        value: getExternalName(specifier),
                    };
                } else if (specifier.type === "ImportDefaultSpecifier" || specifier.type === "ExportDefaultSpecifier") {
                    return { type: "StringLiteral", value: "default" };
                } else if (
                    specifier.type === "ImportNamespaceSpecifier" ||
                    specifier.type === "ExportNamespaceSpecifier"
                ) {
                    return { type: "StringLiteral", value: "__star__" };
                }
            }),
        },
    ];
}

function buildDeclarations(
    path: NodePath<ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration>,
    importArgs: [StringLiteral, ArrayExpression],
    isExport: boolean,
    exportAllAs: string | undefined,
    options: TranspilationOptions
): Node {
    const importCall: CallExpression = {
        type: "CallExpression",
        callee: {
            type: "MemberExpression",
            object: { type: "Identifier", name: options.ctxObject },
            property: { type: "Identifier", name: options.importFunction },
            computed: false,
        },
        arguments: importArgs,
    };

    const properties: ObjectProperty[] =
        path.node.type === "ExportAllDeclaration"
            ? [
                {
                    type: "ObjectProperty",
                    key: { type: "Identifier", name: "__star__" },
                    value: { type: "Identifier", name: exportAllAs },
                    computed: false,
                    shorthand: false,
                },
            ]
            : path.node.specifiers.map((specifier) => {
                let importedName;
                let localName;
                if (specifier.type === "ImportSpecifier" || specifier.type === "ExportSpecifier") {
                    importedName = getExternalName(specifier);
                    localName = isExport && specifier.exported ? getText(specifier.exported) : specifier.local.name;
                } else if (
                    specifier.type === "ImportDefaultSpecifier" ||
                    specifier.type === "ExportDefaultSpecifier"
                ) {
                    importedName = "default";
                    localName = specifier.local.name;
                } else if (
                    specifier.type === "ImportNamespaceSpecifier" ||
                    specifier.type === "ExportNamespaceSpecifier"
                ) {
                    importedName = "__star__";
                    localName = specifier.local.name;
                }

                return {
                    type: "ObjectProperty",
                    key: { type: "Identifier", name: importedName },
                    value: { type: "Identifier", name: localName },
                    computed: false,
                    shorthand: importedName === localName,
                };
            });

    const declarations: VariableDeclaration = {
        type: "VariableDeclaration",
        declarations: [
            {
                type: "VariableDeclarator",
                id: {
                    type: "ObjectPattern",
                    properties: properties,
                },
                init: importCall,
            },
        ],
        kind: "const",
    };

    return isExport
        ? {
            type: "ExportNamedDeclaration",
            declaration: declarations,
            specifiers: [],
        }
        : declarations;
}

export const customImportExportTransform = (options: TranspilationOptions): PluginObj => {
    return {
        visitor: {
            ImportDeclaration(path) {
                transformImportDeclaration(path, false, undefined, options);
            },
            ExportNamedDeclaration(path) {
                // Check if it's an "export {...} from 'source'" form
                if (path.node.source) {
                    transformImportDeclaration(path, true, undefined, options);
                }
                // If it's not, no need to transform it, it's a simple export
            },
            ExportAllDeclaration(path) {
                transformImportDeclaration(path, true, getText(path.node.exported), options);
            },
        },
    };
};

function transformImportDeclaration(
    path: NodePath<ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration>,
    isExport: boolean,
    exportAllAs: string | undefined,
    options: TranspilationOptions
): void {
    const importArgs = buildImportArgs(path);
    const declarations = buildDeclarations(path, importArgs, isExport, exportAllAs, options);
    path.replaceWith(declarations);
}
