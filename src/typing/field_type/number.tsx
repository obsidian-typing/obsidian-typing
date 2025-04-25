import { Visitors } from "src/language";
import { IComboboxOption, Pickers } from "src/ui";
import { field } from "src/utilities";
import { report, Validation } from "src/validation";
import { FieldType } from "./base";

export class Number extends FieldType<Number> {
    name = "Number";

    @field()
    public min: number = 0;

    @field()
    public max: number = 10;

    @field()
    public picker: "dropdown" | "slider" | "rating" = "dropdown";

    validate(target: Validation.Target<unknown>): void | Promise<void> {
        if (typeof target.value === "number") {
            return this.validateTyped(target.asTyped(target.value));
        } else {
            report(target, {
                message: `Field ${target.path} must be a number`
            });
        }
    }

    validateTyped(target: Validation.Target<number>): void | Promise<void> {
        if (target.value < this.min || target.value > this.max) {
            report(target, {
                message: `Field ${target.path} must be between ${this.min} and ${this.max}`
            });
        }
    }

    Display: FieldType["Display"] = ({ value }) => {
        return <>{value}</>;
    };

    Picker = () => {
        let options: IComboboxOption[] = [];
        for (let i = this.min; i <= this.max; i++) {
            options.push({ value: `${i}` });
        }
        return <Pickers.Choice options={options} addQuotesInList={false} />;
    };

    get default() {
        return `${this.min}`;
    }

    static ParametersVisitor = () =>
        Visitors.ParametersVisitorFactory({
            kwargs: {
                min: Visitors.Literal(Visitors.Number),
                max: Visitors.Literal(Visitors.Number),
                picker: Visitors.Literal(Visitors.LiteralString(["dropdown", "slider", "rating"])),
            },
            init(args, kwargs) {
                return Number.new(kwargs);
            },
        });
}
