import { TVisitorBase } from "src/language/visitors";
import { Pickers } from "src/ui";
import { Bindable, DataClass } from "src/utilities";
import { Validation, Validator } from "src/validation";
import { Field } from "../field";
import { Type } from "../type";

export interface FieldTypeBindingContext {
    field: Field;
    inList?: boolean;
    type?: Type;
}

export abstract class FieldType<InstanceType extends FieldType = any>
    extends DataClass
    implements Bindable<FieldTypeBindingContext, InstanceType>, Validator<unknown>
{
    context?: FieldTypeBindingContext;

    abstract readonly name: string;
    static requiresDataview: boolean = false;

    validate(target: Validation.Target<unknown>): void | Promise<void> {
        // No-op validation. Override in derived classes if needed.
    }

    Picker: React.FunctionComponent = () => {
        return <Pickers.String />;
    };

    Display: React.FunctionComponent<{ value: string }> = ({ value }) => {
        return <>{value}</>;
    };

    get default(): string {
        return "";
    }

    parseDefault(value: any): string {
        return `${value}`;
    }

    bind(this: InstanceType, context: FieldTypeBindingContext): InstanceType {
        let instance = this.copy();
        instance.context = context;
        return instance;
    }

    static ParametersVisitor: () => TVisitorBase<any>;

    get isRelation(): boolean {
        return false;
    }

    get isList(): boolean {
        return false;
    }

    get underlyingType(): FieldType {
        return this;
    }
}
