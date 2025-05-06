import { ChangeSpec, EditorState, Text } from "@codemirror/state";
import { SyntaxNode } from "@lezer/common";
import { Spacing, SpacingRules } from "./spacing";
import { WhiteSpace } from "./whitespace";

export function formatTree(state: EditorState, node: SyntaxNode, rules: SpacingRules<SyntaxNode>): { changes: ChangeSpec[] } {
    let changes: ChangeSpec[] = [];

    /** Update {@link whiteSpace} to match {@link spacing}. */
    const applySpacing = (whiteSpace: WhiteSpace, spacing: Spacing | null): boolean => {
        if (!spacing) {
            // Spacing remains unchanged
            return false;
        }

        let change = whiteSpace.applySpacing(spacing);
        if (!change) {
            // Spacing is already correct
            return false;
        }

        changes.push(change);
        return true;
    };

    /** Updates the white space between {@link after} and {@link before} according to the {@link rules}. */
    const updateSpacing = (parent: SyntaxNode, after: SyntaxNode | null, before: SyntaxNode | null): void => {
        if (!after && !before) {
            throw new Error("At least one of after and before must not be null");
        }
        let parentRange = { from: parent.from, to: parent.to };
        let whiteSpace = WhiteSpace.between(doc, parent, after, before)!;
        let spacing = rules.getSpacing(parentRange, parent, after, before);
        applySpacing(whiteSpace, spacing);
    }

    let doc: Text = state.doc;
    let cursor = node.cursor();

    let parent = cursor.node;
    let parentRange = { from: parent.from, to: parent.to };
    let prev: SyntaxNode | null = null;
    if (cursor.firstChild()) {
        do {
            // Handle whitespace at start of parent and between children
            updateSpacing(parent, prev, cursor.node);
            prev = cursor.node;
        } while (cursor.nextSibling());

        // Handle whitespace at end of parent
        updateSpacing(parent, prev, cursor.node);
        prev = null;
    }

    return { changes };
}
