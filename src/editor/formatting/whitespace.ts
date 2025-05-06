import { ChangeSpec, Text } from "@codemirror/state";
import { SyntaxNode, SyntaxNodeRef } from "@lezer/common";
import assert from "assert";
import { Spacing } from "./spacing";

function assertSameNode(a: SyntaxNodeRef | null, b: SyntaxNodeRef | null, message: string) {
    assert(a?.type === b?.type, message);
    assert(a?.to === b?.to, message);
    assert(a?.from === b?.from, message);
}

/**
 * Represents and allows modifications to the whitespace before, after and between nodes.
 */
export class WhiteSpace {
    constructor(
        private readonly doc: Text,
        private readonly from: number,
        private readonly to: number,
        private readonly after: SyntaxNodeRef | null,
        private readonly before: SyntaxNodeRef | null,
    ) {
    }

    getString(): string {
        return this.doc.sliceString(this.from, this.to);
    }

    getText(): Text {
        return this.doc.slice(this.from, this.to);
    }

    applySpacing(spacing: Spacing): ChangeSpec | null {
        return null;
    }

    /**
     * Gets the whitespace between the specified two nodes.
     * {@link after} and {@link before} must be directly adjacent.
     */
    static between(doc: Text, parent: SyntaxNodeRef, after: SyntaxNodeRef, before: SyntaxNodeRef): WhiteSpace;

    /**
     * Gets the whitespace between the start of {@link before}'s {@link parent} and {@link before}.
     * {@link before} must be the first (non-whitespace) child of its {@link parent}.
     */
    static between(doc: Text, parent: SyntaxNodeRef, after: SyntaxNodeRef | null | undefined, before: SyntaxNodeRef): WhiteSpace;

    /**
     * Gets the whitespace between {@link after} and the end of {@link after}'s {@link SyntaxNode#parent}.
     * {@link after} must be the last (non-whitespace) child of its {@link SyntaxNode#parent}.
     */
    static between(doc: Text, parent: SyntaxNodeRef, after: SyntaxNodeRef, before: SyntaxNodeRef | null | undefined): WhiteSpace;

    /**
     * Always returns {@code undefined} if both {@link after} and {@link before}
     * are {@code null} or {@code undefined}.
     */
    static between(doc: Text, parent: SyntaxNodeRef, after: null | undefined, before: null | undefined): null;

    static between(doc: Text, parent: SyntaxNodeRef, after: SyntaxNodeRef | null | undefined, before: SyntaxNodeRef | null | undefined): WhiteSpace | null;

    static between(doc: Text, parent: SyntaxNodeRef, after: SyntaxNodeRef | null | undefined, before: SyntaxNodeRef | null | undefined): WhiteSpace | null {
        if (after && before) {
            // assertSameNode(after.parent, before.parent, "must have same parent");
            // assertSameNode(after.nextSibling, before, "must be directly adjacent");
            // assertSameNode(after, before.prevSibling, "must be directly adjacent");
        } else if (after) {
            assert(!before);
            // assertSameNode(after.nextSibling, null, "must be the last child");
        } else if (before) {
            assert(!after);
            // assertSameNode(before.prevSibling, null, "must be the first child");
        } else {
            return null;
        }

        let from = after?.to ?? parent?.from ?? 0;
        let to = before?.from ?? parent?.to ?? doc.length;
        return new WhiteSpace(doc, from, to, after ?? null, before ?? null);
    }
}
