import { Rules } from "../index_base";
import { createVisitor } from "../visitor";

export type OpToken = "," | ":" | "=" | "`" | "[" | "]" | "(" | ")" | "{"

export const Token = <const R extends OpToken>(nodeType: R) => createVisitor({
    rules: nodeType as Rules,
    run(node) {
        return true;
    }
});

export const Keyword = <const R extends Rules>(nodeType: R) => createVisitor({
    rules: nodeType,
    run(node) {
        return true;
    }
});
