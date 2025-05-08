import { AnyVisitor, NodeType, Rules, Symbol, VisitorArgs } from "..";

export const ScopeWrapper = <Super extends AnyVisitor = any, This extends AnyVisitor = any>(
    base: Super, { shouldComplete = true }: { shouldComplete: boolean }
): VisitorArgs<unknown, unknown, unknown, unknown, This> => {
    return {
        tags: ["scope"],
        symbols() {
            let symbols = [] as Symbol[];
            this.traverse((node, child) => {
                for (let symbol of child.symbols(node)!) {
                    symbols.push(symbol);
                }
            });
            return symbols;
        },
        lint(node) {
            let unexpectedNodes: NodeType[] = [];
            this.traverse(() => { }, {
                callbackNotAccepted(node) {
                    if (node.name == Rules.LineComment) return;
                    unexpectedNodes.push(node);
                },
            });
            for (let node of unexpectedNodes) {
                this.error("Unexpected statement.", node);
            }

            let set = new Set();
            for (let symbol of this.symbols(node)!) {
                if (set.has(symbol.name)) {
                    this.error(`Duplicate symbol: ${symbol.name}`, symbol.nameNode);
                }
                set.add(symbol.name);
            }

            let diagnostics = base.lint(node);
            if (diagnostics) {
                this.joinDiagnostics(diagnostics.diagnostics);
            }
        },
        complete(node) {
            if (!shouldComplete) return [];
            let result = [];
            for (let key in this.children) {
                result.push(...this.children[key].snippets());
            }
            let symbols = this.symbols(node)!.map((x) => x.name);
            result = result.filter((x) => !x.symbol || !symbols.contains(x.symbol));
            for (let i = 0; i < result.length; i++) {
                result[i].boost = -i;
            }
            return result;
        },
    };
};
