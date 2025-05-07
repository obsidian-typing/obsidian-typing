import { indentRange, syntaxTree, syntaxTreeAvailable } from "@codemirror/language";
import { ChangeSpec, EditorSelection, EditorState, SelectionRange, StateCommand } from "@codemirror/state";
import { formatTree } from "./formatter";
import { NodeMatcher } from "./matcher";
import { getSpacingRules, getSpacingSettings } from "./settings";
import { SpacingRules } from "./spacing";

/** Apply automatic language-aware indentation to the current document. */
export const autoIndentDocument: StateCommand = ({ state, dispatch }) => {
    let transaction = state.update({
        changes: indentRange(state, 0, state.doc.length),
        userEvent: "format.indent.document",
    });
    dispatch(transaction);
    return true;
};

/** Apply automatic language-aware indentation to the currently selected range or ranges. */
export const autoIndentRange: StateCommand = ({ state, dispatch }) => {
    let transaction = state.update({
        ...state.changeByRange(range => {
            console.log(`${range.from} - ${range.to}`);
            let changes = indentRange(state, range.from, range.to);
            return {
                range: range.map(changes),
                changes: changes,
            };
        }),
        userEvent: "format.indent.range",
    });
    dispatch(transaction);
    return true;
};

/** Apply automatic formatting to the current document. */
export const autoFormatDocument: StateCommand = ({ state, dispatch }) => {
    let changesToMake = formatDocument(state);
    if (!changesToMake) {
        return false;
    }
    dispatch(state.update({
        ...changesToMake,
        userEvent: "format.auto.document"
    }));
    return true;
};

/** Apply automatic formatting to full document. */
function formatDocument(state: EditorState): { changes: ChangeSpec[] } | null {
    // The current formatting algorithm requires the full parse tree to be available
    if (!syntaxTreeAvailable(state)) {
        // TODO: Retry formatting once background parsing is complete
        //       (but cancel as soon as the user starts typing or performs any other edit).
        return null;
    }
    let tree = syntaxTree(state);

    // TODO: Determine the applicable formatting rules based on the current language
    let options = getSpacingSettings();
    let rules = SpacingRules.create(options, getSpacingRules(options), NodeMatcher.create);

    return formatTree(state, tree.topNode, rules);
}

/** Apply automatic formatting to the currently selected range. */
export const autoFormatRange: StateCommand = ({ state, dispatch }) => {
    // Behave like "Format Document" if nothing is selected
    let selectedRanges = state.selection.ranges;
    if (selectedRanges.length === 0 || selectedRanges.length === 1) {
        return autoFormatDocument({ state, dispatch });
    }

    // Expand multiline ranges to cover full lines
    let expandedRanges = EditorSelection.create(selectedRanges.map(range => expandIfMultiLine(state, range))).ranges;

    // Format the whole document
    let allChanges = formatDocument(state)?.changes;
    if (!allChanges) {
        return false;
    }

    // Filter out everything not related to the current selection
    let transaction = state.update({
        changes: allChanges.filter((change: ChangeSpec) => {
            type SingleChangeSpec = {
                from: number;
                to?: number;
                insert?: string | Text;
            };

            // TODO: Not safe in the general case, but currently safe as long as we only ever return SingleChangeSpec
            let singleChange = change as SingleChangeSpec;
            return expandedRanges.some(range => {
                return singleChange.from <= range.to && (singleChange.to ?? singleChange.from) >= range.from;
            });
        }),
        userEvent: "format.auto.range",
    });
    dispatch(transaction);
    return true;
};

/**
 * Expand {@link range}.{@link SelectionRange#from}` and {@link range}.{@link SelectionRange#to}
 * to the start/end of their respective lines when {@code [from, to)} contains multiple lines.
 */
function expandIfMultiLine(state: EditorState, range: SelectionRange): SelectionRange {
    if (isMultiLine(state, range)) {
        return expandToFullLines(state, range);
    }
    return range;
}

/** Returns whether {@link range} contains multiple lines. */
function isMultiLine(state: EditorState, range: SelectionRange): boolean {
    return state.doc.lineAt(range.from) !== state.doc.lineAt(range.to);
}

/**
 * Expand {@link range}.{@link SelectionRange#from}` and {@link range}.{@link SelectionRange#to}
 * to the start/end of their respective lines.
 */
function expandToFullLines(state: EditorState, range: SelectionRange): SelectionRange {
    return range.extend(
        state.doc.lineAt(range.from).from,
        state.doc.lineAt(range.to).to,
    );
}
