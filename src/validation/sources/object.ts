import { FieldsAsTargets, Target, ValueSourceWithContext } from "./base";
import { FieldKey, FieldPath } from "../reporting";
import { ValidationContext as Ctx } from "../validation_context";

export function objectSource(value: undefined, context: Ctx): undefined;
export function objectSource<T>(value: T, context: Ctx): Target<T>;

export function objectSource<T>(value: T | undefined, context: Ctx): Target<T> | undefined {
    if (value === undefined) {
        return undefined;
    }
    return new ObjectSource<T>(value, FieldPath.new(), context);
}

/**
 * Validation target implementation for plain old JavaScript objects
 * that do not provide any additional context.
 */
class ObjectSource<T> extends ValueSourceWithContext<T> {
    constructor(
        public readonly value: T,
        path: FieldPath<FieldKey>,
        context: Ctx
    ) {
        super(path, context);
    }

    get providerName(): string {
        return "object";
    }

    field<K extends keyof T>(key: K): FieldsAsTargets<T>[K] {
        let result = this.value[key];
        if (result === undefined) {
            return undefined as unknown as FieldsAsTargets<T>[K];
        }
        return new ObjectSource(result, FieldPath.new(this.path, key), this.context) as FieldsAsTargets<T>[K];
    }
}
