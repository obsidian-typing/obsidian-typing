import { Visitors } from "src/language";
import { Pickers } from "src/ui";
import { field, stripQuotes } from "src/utilities";
import { FieldType } from "./base";
import { report, Validation } from "src/validation";

export class Choice extends FieldType<Choice> {
    name = "Choice";

    @field()
    public options: Array<string> = [];

    @field()
    public fuzzy: boolean = true;

    validate(target: Validation.Target<unknown>): void | Promise<void> {
        if (typeof target.value === "string") {
            return this.validateTyped(target.asTyped(target.value));
        } else {
            report(target, {
                message: `Field ${target.path} must be a string`
            });
        }
    }

    validateTyped(target: Validation.Target<string>): void | Promise<void> {
        if (!this.options.includes(target.value)) {
            report(target, {
                message: `Field ${target.path} must be one of the following values: ${this.options.join(", ")}`
            });
        }
    }

    Display: FieldType["Display"] = ({ value }) => {
        if (value && this.context?.inList) {
            value = stripQuotes(value);
        }
        return <>{value}</>;
    };

    Picker = () => {
        let options = this.options.map((x) => ({ value: x }));
        return <Pickers.Choice options={options} />;
    };

    get default() {
        return this.options[0];
    }

    static ParametersVisitor = () =>
        Visitors.ParametersVisitorFactory({
            args: Visitors.Literal(Visitors.String),
            kwargs: {
                fuzzy: Visitors.Literal(Visitors.Boolean),
            },
            init(args, kwargs) {
                return Choice.new({ options: args });
            },
        });
}
