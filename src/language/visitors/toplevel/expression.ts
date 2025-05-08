import { Field, FieldType } from "src/typing";
import * as Composite from "../composite";
import { createVisitor, Rules } from "../index_base";
import * as Pure from "../pure";

export type LiteralValue = string | number | boolean;
export type NamedValue = { name?: string, value?: LiteralValue };
export type ExpressionValue = LiteralValue | Field | FieldType | NamedValue;

export const Expression = createVisitor({
    rules: Rules.File,
    children: {
        expr: createVisitor({
            rules: Rules.Expression,
            children: {
                literal: Pure.Literal(Pure.Union(Pure.String, Pure.Number, Pure.Boolean)),
                field: Composite.Field(),
                fieldType: Composite.FieldType(),
                assignment: Composite.NamedAttribute(Pure.Literal(Pure.Union(Pure.String, Pure.Number, Pure.Boolean))),
            },
            run(node): ExpressionValue | undefined {
                let children = this.runChildren();
                for (let key in children) {
                    // return first key
                    return children[key as keyof typeof children];
                }
                return undefined;
            },
        }),
    },
    run(node) {
        return this.runChildren()["expr"];
    },
});
