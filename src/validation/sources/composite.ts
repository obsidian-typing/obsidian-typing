import { MessageSpec, FieldKey, FieldPath } from "../reporting";
import { FieldsAsTargets, Target, ValueSourceBase } from "./base";

export function compositeSource<T>(...sources: Target<T>[]): Target<T> {
    return new CompositeSource<T>(sources, FieldPath.new());
}

class CompositeSource<T> extends ValueSourceBase<T> implements Target<T> {
    constructor(public readonly sources: Target<T>[], path: FieldPath) {
        super(path);
    }

    get context() {
        // TODO: Array might be empty
        return this.sources[0].context;
    }

    get providerName() {
        return "composite";
    }

    get value(): T {
        // TODO: Deep merge?
        return undefined as any;
    }

    report(message: MessageSpec): void {
        return this.sources[0]?.report(message);
    }

    field<K extends keyof T>(key: K): FieldsAsTargets<T>[K] {
        for (let source of this.sources) {
            let result = source.field(key);
            if (result !== undefined) {
                return result;
            }
        }

        // TODO: The line below may break type assumptions
        return undefined as unknown as FieldsAsTargets<T>[K];
    }

    asTyped<U>(value: U): Target<U> {
        return super.asTyped(value) as Target<U>;
    }
}
