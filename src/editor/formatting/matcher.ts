import { NodeType, SyntaxNode, SyntaxNodeRef } from "@lezer/common";

/**
 * Describes a condition that matches certain nodes (most likely based on their type).
 *
 * @see {@link NodeMatcher}
 */
export type NodeMatcherSpec = string | string[] | NodePredicate;

export type NodePredicate = (node: SyntaxNodeRef) => boolean

/**
 * Represents a condition that matches certain nodes (most likely based on their type).
 * Created from a {@link NodeMatcherSpec}.
 */
export interface NodeMatcher<TNode> {
    debugName?: string;
    matches(node: TNode): boolean;
}

export namespace NodeMatcher {
    export function create(spec: NodeMatcherSpec): NodeMatcher<SyntaxNodeRef> {
        if (typeof spec === "string") {
            let segments = spec.split("/");
            if (segments.length === 1) {
                return {
                    debugName: spec,
                    matches(node) {
                        return node.name === spec;
                    }
                }
            } else {
                let self = segments[segments.length - 1];
                let ancestors = segments.slice(0, segments.length - 1).reverse();
                return {
                    debugName: spec,
                    matches(node) {
                        return (!self || node.name === self) && node.matchContext(ancestors);
                    }
                };
            }
        } else if (typeof spec === "function") {
            return { matches: spec };
        } else if (spec instanceof Array) {
            // TODO: This is inefficient
            let matchers = spec.map(unionMember => NodeMatcher.create(unionMember));
            return {
                debugName: spec.join(" | "),
                matches(node) {
                    return matchers.some(m => m.matches(node));
                }
            }
        } else {
            throw new Error("Invalid NodeMatcherSpec")
        }
    }
}
