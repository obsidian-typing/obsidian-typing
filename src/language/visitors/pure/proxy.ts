import { AnyVisitor, createVisitor, Rules } from "../index_base";

export const Proxy = <V extends AnyVisitor>(proxyRules: Rules | Rules[], visitor: V):
    AnyVisitor<{
        Return: ReturnType<V["run"]>,
        Children: { visitor: V; }
    }> =>
    createVisitor({
        rules: proxyRules,
        children: { visitor },
        accept(node) {
            return visitor.accept(node.firstChild!);
        },
        run(node) {
            return visitor.run(node.firstChild!) as ReturnType<V["run"]>;
        },
        lint(node) {
            return visitor.lint(node.firstChild!);
        },
        complete(node, context) {
            return visitor.complete(node.firstChild!, context);
        },
        snippets() {
            return visitor.snippets();
        },
    });
