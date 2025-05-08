import { Completion, snippet, snippetCompletion } from "@codemirror/autocomplete";
import { Decoration, WidgetType } from "@codemirror/view";
import { SyntaxNode } from "@lezer/common";
import { Action, Field, Hook, HookContainer, HookNames, Method, Prefix, Style, Type as TypeObject } from "src/typing";
import { stripQuotes } from "src/utilities";
import * as Visitors from "../composite";
import { createVisitor, Rules, Symbol } from "../index_base";
import * as Wrappers from "../wrappers";

class IconWidget extends WidgetType {
    constructor(readonly icon: string) {
        super();
    }

    eq(other: IconWidget) {
        return other.icon == this.icon;
    }

    toDOM() {
        let wrap = document.createElement("span");
        // wrap.className = "typing-icon-preview";
        let box = wrap.appendChild(document.createElement("span"));
        box.className = this.icon;
        return wrap;
    }

    ignoreEvent() {
        return false;
    }
}

export const TypeParentsClause = createVisitor({
    rules: Rules.ExtendsClause,
    children: { parent: Visitors.Identifier({ allowString: true }) },
    utils: {
        globalSymbols(node?: SyntaxNode) {
            // TODO: Respect the `node` parameter
            let globalScope = this.getParent({ tags: ["scope"] });
            if (!globalScope) throw new Error("Failed to get global symbols: Not within a scope");
            let globalScopeNode: SyntaxNode | null = this.node;
            while (globalScopeNode && globalScopeNode.name != Rules.File) globalScopeNode = globalScopeNode.parent;
            if (!globalScopeNode) throw new Error("Failed to get global symbols: Not within a scope");;
            return globalScope.symbols(globalScopeNode) ?? [];
        },
    },
    lint(node) {
        let globalTypes = this.utils.globalSymbols(node);
        this.traverse((node, child) => {
            let name = child.run(node);
            for (let type of globalTypes) {
                if (type.name === name && type.node.to <= node.from) {
                    return;
                }
            }
            this.error(`No such parent: ${name}`, node);
        });
    },
    run(node) {
        let result: string[] = [];
        this.traverse((node, child) => {
            let name = child.run(node);
            if (!name) return;
            result.push(name);
        });
        return result;
    },
    complete(node) {
        let currentParents = this.symbols(node)!.map((x) => x.name);
        return this.utils
            .globalSymbols()
            .filter((x: Symbol) => x.node.to < node.from)
            .filter((x: Symbol) => !currentParents.contains(x.name))
            .map((x: Symbol) => {
                let name = x.name;

                // TODO: improve, check by regex or Identifier
                if (name.contains(" ")) {
                    name = `"${name}"`;
                }

                return {
                    label: name,
                    apply: (...args) => snippet(x.name)(...args),
                } as Completion;
            });
    },
    symbols() {
        let res: Symbol[] = [];
        this.traverse((node, child) => {
            let name = child.run(node);
            if (!name) return;
            res.push({ node, nameNode: node, name: name });
        });
        return res;
    },
});

export const Type = createVisitor({
    rules: Rules.TypeDeclaration,
    tags: ["typedecl"],
    children: {
        isAbstract: Visitors.Keyword(Rules.KeywordAbstract),
        name: Visitors.Identifier({ allowString: true }),
        parentNames: TypeParentsClause,
        body: createVisitor({
            rules: Rules.TypeBody,
            run(node) {
                return this.runChildren();
            },
            children: {
                folder: Visitors.Attribute("folder", Visitors.String), // will be FolderCompletionString or String(completion=...)
                // TODO: can be specified only in abstract types
                // TODO: can be specified one of folder and glob
                glob: Visitors.Attribute("glob", Visitors.String), // will be FolderCompletionString or String(completion=...)

                // TODO: store current prefixes in `data.json`, on prefix change
                // rename all the notes in folder sorted by `cdate`, this way the order on {serial} will be preserved
                prefix: Visitors.Attribute("prefix", Visitors.String).override(base => ({
                    run(node) {
                        return Prefix.new({ template: base.run(node) });
                    },
                })),
                icon: Visitors.Attribute("icon", Visitors.String).override(base => ({
                    decorations(node) {
                        let valueNode = node.getChild(Rules.AssignmentValue);
                        if (!valueNode) return [];
                        let icon = stripQuotes(this.getNodeText(valueNode));
                        return [
                            Decoration.widget({
                                widget: new IconWidget(icon),
                                side: 1,
                            }).range(valueNode.to),
                        ];
                    },
                })),
                display: Visitors.StructuredSection(
                    "display",
                    {
                        title: Visitors.Attribute("title", Visitors.String),
                        description: Visitors.Attribute("description", Visitors.String),
                        category: Visitors.Attribute("category", Visitors.String)
                    },
                    "Display section"
                ).override(base => ({
                    run(node) {
                        return this.runChild("body");
                    },
                })),
                style: Visitors.StructuredSection(
                    "style",
                    {
                        header: Visitors.Attribute(
                            "header",
                            Visitors.Union(
                                Visitors.FnScriptString(),
                                Visitors.ExprScriptString(),
                                Visitors.MarkdownString()
                            )
                        ),
                        footer: Visitors.Attribute(
                            "footer",
                            Visitors.Union(
                                Visitors.FnScriptString(),
                                Visitors.ExprScriptString(),
                                Visitors.MarkdownString()
                            )
                        ),
                        link: Visitors.Attribute(
                            "link",
                            Visitors.Union(Visitors.FnScriptString(), Visitors.ExprScriptString())
                        ),
                        css: Visitors.Attribute(
                            "css",
                            Visitors.CSSString()
                        ),
                        css_classes: Visitors.Attribute("css_classes", Visitors.List(Visitors.String)),
                        show_prefix: Visitors.Attribute(
                            "show_prefix",
                            Visitors.LiteralString(["always", "smart", "never"])
                        ),
                        hide_inline_fields: Visitors.Attribute(
                            "hide_inline_fields",
                            Visitors.LiteralString(["all", "none", "defined"])
                        ),
                    },
                    "Style section"
                ).override(base => ({
                    run(node) {
                        let opts = this.runChild("body");
                        return Style.new(opts);
                    },
                })),
                actions: Visitors.Section(
                    "actions",
                    Visitors.NamedAttribute(
                        Visitors.StructuredObject({
                            name: Visitors.Attribute("name", Visitors.String),
                            icon: Visitors.Attribute("icon", Visitors.String).override(base => ({
                                decorations(node) {
                                    let valueNode = node.getChild(Rules.AssignmentValue);
                                    if (!valueNode) return [];
                                    let icon = stripQuotes(this.getNodeText(valueNode));
                                    return [
                                        Decoration.widget({
                                            widget: new IconWidget(icon),
                                            side: 1,
                                        }).range(valueNode.to),
                                    ];
                                },
                            })),
                            script: Visitors.Attribute("script", Visitors.FnScriptString()),
                            shortcut: Visitors.Attribute("shortcut", Visitors.String),
                        })
                    ).extend(base => ({
                        run(): Action {
                            let { name: id, value } = this.runChildren();
                            return Action.new({ id, ...value });
                        },
                    }))
                ).extend(base => ({
                    run(): Record<string, Action> {
                        let result: Record<string, Action> = {};
                        for (let action of this.runChild("body") ?? []) {
                            result[action.id] = action;
                        }
                        return result;
                    },
                })),
                hooks: Visitors.StructuredSection(
                    "hooks",
                    {
                        create: Visitors.Attribute("create", Visitors.FnScriptString()),
                        on_create: Visitors.Attribute("on_create", Visitors.FnScriptString()),
                        on_rename: Visitors.Attribute("on_rename", Visitors.FnScriptString()),
                        on_open: Visitors.Attribute("on_open", Visitors.FnScriptString()),
                        on_close: Visitors.Attribute("on_close", Visitors.FnScriptString()),
                        on_metadata_change: Visitors.Attribute("on_metadata_change", Visitors.FnScriptString()),
                        on_validate: Visitors.Attribute("on_validate", Visitors.FnScriptString()),
                    },
                    "Hooks"
                ).extend(base => ({
                    run(node) {
                        let hooksList = this.runChild("body");
                        let hooks: Partial<Pick<HookContainer, HookNames>> = {};
                        for (let key in hooksList) {
                            hooks[key as HookNames] = Hook.new({ func: hooksList[key as HookNames] });
                        }
                        return HookContainer.new(hooks);
                    },
                })),
                methods: Visitors.Section(
                    "methods",
                    Visitors.NamedAttribute(Visitors.ExprScriptString("(${params}) => {\n\t${}\n}"))
                ).extend(base => ({
                    run(node) {
                        let methodsList = this.runChild("body") ?? [];
                        let methods: Record<string, Method> = {};
                        for (let { name, value } of methodsList) {
                            if (name === null || name === undefined) continue;
                            methods[name] = Method.new({ function: value });
                        }
                        return methods;
                    },
                })),
                fields: Visitors.Section("fields", Visitors.Field()).extend(base => ({
                    run(): Record<string, Field> {
                        let result: Record<string, Field> = {};
                        // TODO: Review handling of null/undefined
                        for (let field of this.runChildren()["body"]!) {
                            result[field.name] = field;
                        }
                        return result;
                    },
                })),
            },
        }).extend(base => Wrappers.ScopeWrapper(base, { shouldComplete: true })),
    },
    run() {
        let { isAbstract, name, parentNames, body } = this.runChildren({ keys: ["isAbstract", "name", "parentNames", "body"] });
        let type = TypeObject.new({
            isAbstract,
            name,
            parentNames,
            ...body?.display,
            ...body,
        });
        return [type];
    },
    snippets() {
        return [
            snippetCompletion("type ${name} extends ${parents} {\n\t${}\n}", {
                label: "type ... extends ... { ... }",
                info: "A type with parents.",
            }),
            snippetCompletion("type ${name} {\n\t${}\n}", {
                label: "type ... { ... }",
                info: "A type without parents.",
            }),
        ];
    },
    // TODO: fix
    options: {
        cache: { lint: false, run: false, complete: false },
    },
    symbols(node) {
        let nameNode = node.getChild(Rules.LooseIdentifier);
        if (!nameNode) return null;
        let name = this.children.name.run(nameNode);
        if (!name) return null;
        return [{ name, nameNode, node }];
    },
});
