import { indentRange } from "@codemirror/language";
import { StateCommand } from "@codemirror/state";

/** Apply automatic language-aware indentation to the current document. */
export const autoIndentDocument: StateCommand = ({state, dispatch}) => {
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
