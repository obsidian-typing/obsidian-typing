import { Visitors } from "src/language/visitors";
import { Pickers } from "src/ui";
import { stripQuotes } from "src/utilities";
import { FieldType } from "./base";

export class Text extends FieldType<Text> {
    name = "Text";

    Display: FieldType["Display"] = ({ value }) => {
        if (this.context?.inList) {
            value = stripQuotes(value);
        }
        return <>{value}</>;
    };

    Picker: React.FunctionComponent = () => {
        return <Pickers.Text />;
    };

    get default() {
        return "";
    }

    static ParametersVisitor = () =>
        Visitors.ParametersVisitorFactory({
            init() {
                return Text.new();
            },
        });
}
