import { SyntaxNode } from "@lezer/common";
import { gctx } from "src/context";
import { Field as FieldObject, FieldType as FieldTypeObject, FieldTypes } from "src/typing";
import * as Visitors from ".";
import { AnyVisitor, createVisitor, Rules } from "../index_base";

type RetType<V extends AnyVisitor> = V extends AnyVisitor<{ Return: infer R }> ? R : never;
type RetTypeMap<M extends Record<string, AnyVisitor>> = { [K in keyof M]: RetType<M[K]> };

const createKwargChildren = (kwargs: Record<string, AnyVisitor>) => {
    const kwargChildren: Record<string, AnyVisitor> = {};

    for (let key in kwargs) {
        kwargChildren[key] = createVisitor({
            rules: Rules.Parameter,
            children: {
                value: Visitors.Proxy(Rules.ParameterValue, kwargs[key]),
            },
            accept(node) {
                const nameNode = node.getChild(Rules.ParameterName);
                return !!nameNode && this.getNodeText(nameNode) === key;
            },
            run(node) {
                return this.runChildren()["value"];
            },
            symbols(node) {
                return [{ name: key, node: node, nameNode: node.getChild(Rules.ParameterName)! }];
            },
        });
    }

    return kwargChildren;
};

export const ParametersVisitorFactory = <Arg extends AnyVisitor, Kwargs extends Record<string, AnyVisitor>, Ret>({
    args,
    kwargs,
    lint,
    init,
}: {
    args?: Arg;
    kwargs?: Kwargs;
    lint?: (this: AnyVisitor, args: { value: RetType<Arg>, node: SyntaxNode }[], kwargs: { [K in keyof Kwargs]: { value: RetType<Kwargs[K]>, node: SyntaxNode } }) => void;
    init: (this: AnyVisitor, args: Exclude<RetType<Arg>, undefined>[], kwargs: RetTypeMap<Kwargs>) => Ret;
}) => {
    const argChildren: Partial<{ literal: AnyVisitor<any> }> = args
        ? { literal: Visitors.Proxy(Rules.ParameterValue, args) }
        : {};
    const kwargChildren = kwargs ? createKwargChildren(kwargs) : {};

    return createVisitor({
        rules: Rules.ParameterList,
        children: {
            __arg: createVisitor({
                rules: Rules.Parameter,
                children: argChildren,
                accept(node) {
                    return !node.getChild(Rules.ParameterName);
                },
                run(node) {
                    return this.runChildren()["literal"];
                },
            }),
            ...kwargChildren,
        },
        run(node) {
            const argVisitor = this.children.__arg;
            const args: Exclude<RetType<Arg>, undefined>[] = [];

            this.traverse((node, child) => {
                if (child === argVisitor) {
                    let arg = child.run(node);
                    if (arg !== undefined) {
                        args.push(arg);
                    }
                }
            });

            const kwargsResults = this.runChildren();
            return init.call(this, args, kwargsResults as RetTypeMap<Kwargs>);
        },
        lint(node) {
            let metKwarg = false;
            let argVisitor = this.children.__arg;
            let kwargsSet = new Set();
            let argsAfterKwargs: (typeof node)[] = [];
            let notAccepted: (typeof node)[] = [];
            let repeatedKwargs: (typeof node)[] = [];

            let argsWithNodes: { value: RetType<Arg>, node: typeof node }[] = [];
            let kwargsWithNodes: Record<string, { value: any, node: typeof node }> = {};

            this.traverse(
                (node, child) => {
                    if (child == argVisitor) {
                        argsWithNodes.push({ value: child.run(node), node });
                        if (metKwarg) {
                            argsAfterKwargs.push(node);
                        }
                    } else {
                        metKwarg = true;
                        for (let symbol of child.symbols(node)!) {
                            if (kwargsSet.has(symbol.name)) {
                                repeatedKwargs.push(symbol.node);
                            }
                            kwargsSet.add(symbol.name);
                            kwargsWithNodes[symbol.name] = { value: child.run(symbol.node), node: symbol.node };
                        }
                    }
                },
                {
                    callbackNotAccepted(node) {
                        notAccepted.push(node);
                    },
                }
            );

            lint?.call(this, argsWithNodes, kwargsWithNodes as any);

            argsAfterKwargs.forEach((node) => this.error("Args should go strictly before kwargs.", node));
            notAccepted.forEach((node) => this.error("Unexpected parameter.", node));
            repeatedKwargs.forEach((node) => this.error("Repeated parameter.", node));
        },
    });
};

const fieldTypesByName = FieldTypes as Partial<Record<string, {
    new: (args: {}) => FieldTypeObject,
    ParametersVisitor: (typeof FieldTypeObject)["ParametersVisitor"]
}>>;

export const FieldType = () =>
    createVisitor({
        rules: Rules.AssignmentType,
        children: {
            name: Visitors.Identifier(),
        },
        lint(node) {
            let name = this.runChildren({ keys: ["name"] })["name"];
            if (!name) return;
            if (!(name in FieldTypes)) {
                this.error(`Unknown field type: ${name}. Allowed types: ${Object.keys(FieldTypes)}`);
                return;
            }
            let params = node.getChild(Rules.ParameterList);
            if (!params) return;
            let fieldType = FieldTypes[name as keyof typeof FieldTypes];
            if (fieldType.requiresDataview && !gctx.dv) {
                // TODO: action "Install DataView"
                this.error(`${name} requires DataView.`);
                return;
            }
            let paramsVisitor = fieldType.ParametersVisitor();
            if (!paramsVisitor) {
                this.error(`${name} does not take parameters`, params);
                return;
            }
            let diagnostics = paramsVisitor.lint(params);
            this.joinDiagnostics(diagnostics.diagnostics);
        },
        run(node): FieldTypeObject {
            let name = this.runChildren({ keys: ["name"] })["name"];
            // TODO: Graceful recovery by returning an InvalidType sentinel value?
            if (!name) throw new Error("Failed to parse field type");
            let type = fieldTypesByName[name];
            if (!type) throw new Error(`No field type named '${name}' was found`);
            let paramsVisitor = type.ParametersVisitor();
            let params = node.getChild(Rules.ParameterList);
            if (!params) {
                return type.new({});
            }
            return paramsVisitor.run(params);
        },
    });

const Any = () => Visitors.Union(Visitors.String, Visitors.Number, Visitors.Boolean);
const AnyComposite = () => Visitors.Union(Visitors.List(Any()), Any());

export const Field = () =>
    createVisitor({
        rules: Rules.Assignment,
        children: {
            name: Visitors.Proxy(Rules.AssignmentName, Visitors.Identifier({ allowString: true })),
            type: FieldType(),
            default: createVisitor({
                rules: Rules.AssignmentValue,
                run() {
                    return this.runChildren({ keys: ["literal"], eager: true })["literal"];
                },
                children: {
                    literal: Visitors.Literal(AnyComposite()),
                },
            }),
        },
        run(): FieldObject {
            let { name, type, default: defaultValue, ...opts } = this.runChildren();
            return FieldObject.new({
                name: name ?? undefined,
                type: type ?? undefined,
                // TODO: We temporarily cheat the compiler here:
                //
                //       While defaultValue might have a non-string type,
                //       the constructor will turn it into a string value
                //       using type.parseDefault anyway.
                //
                //       We will have to revisit this in the future once we
                //       add better support for composite values (arrays, objects).
                default: defaultValue as string ?? undefined,
                ...opts
            });
        },
        symbols(node) {
            let nameNode = node.getChild(Rules.AssignmentName);
            if (!nameNode) return null;;
            let name = this.children.name.run(nameNode);
            if (!name) return null;
            return [{ name, nameNode, node }];
        },
    });
