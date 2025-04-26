import { createVisitor, Rules, TUtilsBase, TVisitorBase, Visitor } from "../index_base";

export const Proxy = <V extends TVisitorBase>(proxyRules: Rules | Rules[], visitor: V):
    Visitor<ReturnType<V["run"]>, { visitor: V; }, TUtilsBase, unknown, TVisitorBase<any, any, any, any>> =>
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
