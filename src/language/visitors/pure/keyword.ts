import { Rules } from "../index_base";
import { createVisitor } from "../visitor";

export const Keyword = <const R extends Rules>(nodeType: R) => createVisitor({
    rules: nodeType,
    run(node) {
        return true;
    }
});
