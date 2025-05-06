import { ChangeSpec, EditorState, Text } from "@codemirror/state";
import { IterMode, SyntaxNode } from "@lezer/common";
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
    let cursor = node.cursor(IterMode.IgnoreMounts | IterMode.IgnoreOverlays);
    let top = cursor.node;

    // TODO: Optimization: This currently reifies the whole tree into SyntaxNode
    //       Because it needs to keep track of more than one node at a time.
    //       This could be optimized to a certain degree by only storing the minimal
    //       information needed (i.e. type, from, to) for non-current nodes.

    let parent = cursor.node;
    let prev: SyntaxNode | null = null;
    while (true) {
        let startingPoint = cursor.node;
        if (cursor.firstChild()) {
            // Handle whitespace at start of parent
            parent = startingPoint;
            prev = null;
            updateSpacing(parent, null, cursor.node);
            prev = cursor.node;
        } else if (cursor.nextSibling()) {
            // Handle whitespace between nodes
            updateSpacing(parent, prev, cursor.node);
            prev = cursor.node;
        } else {
            if (prev) {
                // Handle whitespace at end of parent
                updateSpacing(parent, prev, cursor.node);
                prev = null;
            }

            // Continute iteration at parent
            if (!cursor.next() || cursor.node === top) {
                // We have reached the top of our (sub-)tree
                break;
            }

            // TODO: We should always be inside a subtree and thus parent should never be null here
            parent = cursor.node.parent!;
            // TODO: Optimization: Find a way to get rid of bidirectional tree traversal.
            //       This probably involves checking the rule conditions in lock-step with traversing the tree.
            prev = cursor.node.prevSibling;

            // Handle whitespace between nodes
            updateSpacing(parent, prev, cursor.node);
            prev = cursor.node;
        }
    }

    return { changes };
}
