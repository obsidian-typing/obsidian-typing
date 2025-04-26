import { Visitors } from "src/language";
import { field } from "src/utilities";
import { FieldType, FieldTypeBindingContext } from "./base";

export class Required extends FieldType<Required> {
    name = "Required";

    @field({ required: true })
    public type!: FieldType;

    Display: FieldType["Display"] = ({ value }) => {
        const SubDisplay = this.type.Display;
        return <SubDisplay value={value} />;
    };

    Picker = () => {
        const SubPicker = this.type.Picker;
        return <SubPicker />;
    };

    get default() {
        return this.type.default;
    }

    parseDefault(value: any): string {
        return this.type.parseDefault(value);
    }

    bind(context: FieldTypeBindingContext): Required {
        let result = super.bind(context);
        // TODO: there may be some troubles with field name, as it will be the same as of outer type
        // result.type = result.type.bind({ type: context.type });
        result.type = result.type.bind(context);
        return result;
    }

    static ParametersVisitor() {
        return Visitors.ParametersVisitorFactory({
            args: Visitors.FieldType(),
            init(args) {
                return Required.new({ type: args[0] });
            },
        });
    }

    get isRelation() {
        return this.type.isRelation;
    }

    get isList() {
        return this.type.isList;
    }

    get underlyingType() {
        return this.type.underlyingType;
    }
}
