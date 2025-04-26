import { snippet, startCompletion } from "@codemirror/autocomplete";
import { SyntaxNode } from "@lezer/common";
import * as Visitors from ".";
import { createVisitor, Rules, TVisitorBase } from "../index_base";

export const List = <V extends TVisitorBase>(valueType: V, opts?: { info?: string }) =>
    createVisitor({
        rules: Rules.List,
        children: {
            value: Visitors.Literal(valueType),
        },
        complete(node) {
            return valueType.snippets();
        },
        run() {
            let result: ReturnType<V["run"]>[] = [];
            let unexpectedNodes: SyntaxNode[] = [];
            this.traverse(
                (node, child) => {
                    let item = child.run(node);
                    if (item !== undefined) {
                        result.push(item);
                    }
                },
                {
                    callbackNotAccepted(node) {
                        unexpectedNodes.push(node);
                    },
                }
            );
            for (let node of unexpectedNodes) this.error("Unexpected value type", node);
            return result;
        },
        snippets() {
            return [
                {
                    label: `[ ... ]`,
                    apply: (view, completion, from, to) => {
                        snippet("[${}]")(view, completion, from, to);
                        startCompletion(view);
                    },
                    info: opts?.info,
                    detail: "list",
                },
            ];
        },
    });
