import { Visitors } from "src/language";
import { Pickers } from "src/ui";
import { field } from "src/utilities";
import { FieldType } from "./base";
import { report, TypedValidator, Validation } from "src/validation";

export class Boolean extends FieldType<Boolean> implements TypedValidator<boolean> {
    name = "Boolean";

    @field()
    public picker: "checkbox" | "toggle" = "checkbox";

    validate(target: Validation.Target<unknown>): void | Promise<void> {
        if (typeof target.value === "boolean") {
            return this.validateTyped(target.asTyped(target.value));
        } else {
            report(target, {
                message: `Field ${target.path} must be a boolean`
            });
        }
    }

    validateTyped(target: Validation.Target<boolean>): void | Promise<void> {
    }

    Display: FieldType["Display"] = ({ value }) => {
        return <>{value}</>;
    };

    Picker = () => {
        if (this.picker == "checkbox") return <Pickers.Checkbox />;
        // if (this.picker == "toggle") return <Pickers.Toggle />;
    };

    get default() {
        return `false`;
    }

    parseDefault(value: number | string | boolean): string {
        if (typeof value == "boolean") {
            return value ? "true" : "false";
        }
        if (typeof value == "number") {
            return value > 0 ? "true" : "false";
        }
        return value;
    }

    static ParametersVisitor = () =>
        Visitors.ParametersVisitorFactory({
            kwargs: {
                picker: Visitors.Literal(Visitors.LiteralString(["checkbox"])), // TODO: add toggle when implemented
            },
            init(args, kwargs) {
                return Boolean.new(kwargs);
            },
        });
}
