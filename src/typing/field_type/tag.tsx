import { gctx } from "src/context";
import { Visitors } from "src/language";
import { Pickers } from "src/ui";
import { field, stripQuotes } from "src/utilities";
import { report, Validation, TypedValidator } from "src/validation";
import { FieldType } from "./base";

export class Tag extends FieldType<Tag> implements TypedValidator<string> {
    name = "Tag";

    static requiresDataview = true;

    @field()
    public options: Array<string> = [];

    @field()
    public dynamic: boolean = false;

    @field()
    public fuzzy: boolean = true;

    validate(target: Validation.Target<unknown>): void | Promise<void> {
        if (typeof target.value === "string") {
            this.validateTyped(target.asTyped(target.value))
        } else {
            report(target, {
                message: `Field ${target.path} must be a string`
            });
        }
    }

    validateTyped(target: Validation.Target<string>): void | Promise<void> {
        // Note: this.options only contains a list of suggestions,
        //       but all other values are also allowed => No validation necessary.
    }

    Display: FieldType["Display"] = ({ value }) => {
        if (this.context?.inList) {
            value = stripQuotes(value);
        }
        return <>{value}</>;
    };

    Picker = () => {
        let options = this.options;
        if (this.dynamic && this.context?.type?.folder && this.context?.field?.name) {
            let dynamicOptions = Array.from(
                gctx.dv.pages(`"${this.context.type.folder}"`).map((p) => p[this.context!.field.name])
            );
            // TODO: Correctly convert Literal to string
            options = [].concat(...options as any[], ...dynamicOptions); // flatten
            options = options.filter((x) => typeof x == "string");
            options = Array.from(new Set(options));
        }
        return <Pickers.Choice options={options.map((value) => ({ value }))} dynamic={this.dynamic} />;
    };

    get default() {
        return this.options[0];
    }

    static ParametersVisitor = () =>
        Visitors.ParametersVisitorFactory({
            args: Visitors.Literal(Visitors.String),
            kwargs: {
                dynamic: Visitors.Literal(Visitors.Boolean),
                fuzzy: Visitors.Literal(Visitors.Boolean),
            },
            init(args, kwargs) {
                return Tag.new({ options: args, ...kwargs });
            },
        });
}
