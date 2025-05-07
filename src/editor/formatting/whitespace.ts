import { ChangeSpec, Text } from "@codemirror/state";
import { SyntaxNode, SyntaxNodeRef } from "@lezer/common";
import assert from "assert";
import { Spacing } from "./spacing";

// TODO: Review if we need to include more whitespace/linebreak characters in the regular expressions
// TODO: Make these configurable for different languages?
const LINE_FEED = /[\n\r]/u;
const WHITE_SPACE = /[\s]/u;
const ALL_WHITE_SPACE = /^[\s]*$/ug;

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

    containsLineFeeds(): boolean {
        return !!this.getString().match(LINE_FEED);
    }

    containsOnlySpaces(): boolean {
        return !!this.getString().match(ALL_WHITE_SPACE);
    }

    applySpacing(spacing: Spacing): ChangeSpec | null {
        if (this.containsLineFeeds()) {
            // TODO: Not yet implemented: Also format blank lines and line breaks, remove trailing spaces etc.
            return null;
        }

        let match = this.getString().match(ALL_WHITE_SPACE);
        if (!match) {
            // Does contain other characters than just whitespaces.
            // This is not expected to happen when languages are written in such a way
            // that only spaces are not contained in any syntax node.
            return null;
        }

        // TODO: Determine number of current spaces (the current implementation is very crude and does not work well e.g. for tabs)
        let currentSpaces = match?.[0].length ?? 0;
        let newSpaces = Math.clamp(currentSpaces, spacing.minSpaces, spacing.maxSpaces);
        if (newSpaces === currentSpaces) {
            // No change necessary
            // TODO: Normalization of unusual space characters?
            return null;

        }

        // Update the number of spaces
        return { from: this.from, to: this.to, insert: " ".repeat(newSpaces) };
    };

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

function assertSameNode(a: SyntaxNodeRef | null, b: SyntaxNodeRef | null, message: string) {
    assert(a?.type === b?.type, message);
    assert(a?.to === b?.to, message);
    assert(a?.from === b?.from, message);
}
