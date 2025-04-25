import { FieldOrigin, FieldKey, FieldPath, MessageSpec, Span } from "../reporting";
import { ValidationContext } from "../validation_context";

export type FieldsAsValueSources<T, U = Required<NonNullable<T>>> = {
    readonly [K in keyof U]: ValueSource<NonNullable<U[K]>>
};

/**
 * Represents an object or value that is being validated,
 * and allows reporting validation errors on it.
 */
export interface ValueSource<out T> {
    /**
     * Gets the object or value that is being validated.
     */
    readonly value: T;

    /**
     * Gets an identifier for the location of this target within the object tree
     * and/or source text to enable exact reporting of error locations.
     *
     * Implementations of {@link Validator} should treat {@link Path} values as
     * opaque identifiers, where only the validation runtime knows how to translate
     * these to specific locations in the document text or the UI.
     */
    readonly path: FieldPath;

    /**
     * Gets a new validation {@link ValueSource} that represents the
     * specified subfield of {@link value}.
     *
     * @param key Which subfield of {@link value} to retrieve.
     *
     * @see {@link fields}
     */
    field<K extends keyof T>(key: K): FieldsAsValueSources<T>[K];

    asTyped<U>(value: U): ValueSource<U>;
}

export type FieldsAsTargets<T, U = Required<NonNullable<T>>> = {
    readonly [K in keyof U]: Target<NonNullable<U[K]>>
};

export interface Target<T> extends ValueSource<T> {
    readonly context: ValidationContext;

    /**
     * Report an error associated with this validation target.
     */
    report(message: MessageSpec): void;

    field<K extends keyof T>(key: K): FieldsAsTargets<T>[K];

    asTyped<U>(value: U): Target<U>;
}

export abstract class ValueSourceBase<T, Key extends FieldKey = FieldKey> implements ValueSource<T> {
    private _fields?: any;

    constructor(
        public readonly path: FieldPath<Key>
    ) {
    }

    abstract readonly value: T;

    get fields(): FieldsAsValueSources<T> {
        return this._fields ?? (this._fields = new Proxy<any>({}, {
            get: (_target, key, _receiver) => {
                return this.field(key as keyof T);
            }
        }));
    }

    abstract field<K extends keyof T>(key: K): FieldsAsValueSources<T>[K];

    asTyped<U>(value: U): ValueSource<U> {
        if (value === this.value as any) {
            return this as any as ValueSource<U>;
        } else {
            let result = Object.create(this);
            result.value = value;
            return result;
        }
    }
}

export abstract class ValueSourceWithContext<T> extends ValueSourceBase<T> implements Target<T> {
    constructor(
        path: FieldPath,
        public readonly context: ValidationContext
    ) {
        super(path);
    }

    abstract field<K extends keyof T>(key: K): FieldsAsTargets<T>[K];

    resolveLocation(span?: Span): FieldOrigin {
        if (!span) {
            return {
                path: this.path,
                span: {
                    start: 0,
                    end: 0,
                    length: 0,
                    relativeTo: "document"
                }
            }
        }
        throw new Error("TODO");
    }

    report(msg: MessageSpec): void {
        this.context.report({
            message: msg.message,
            level: msg.level ?? "error",
            location: msg.span ? this.resolveLocation({
                start: msg.span.start,
                end: msg.span.end ?? (msg.span.start + (msg.span?.length ?? 0)),
                length: msg.span.length ?? ((msg.span.end ?? msg.span.start) - msg.span.start),
                // TODO: Resolve spans relative to correct anchor
                relativeTo: "target",
            }) : this.resolveLocation({
                start: 0,
                end: 0,
                length: 0,
                // TODO: Resolve spans relative to correct anchor
                relativeTo: "target"
            }),
        });
    }

    asTyped<U>(value: U): Target<U> {
        return super.asTyped(value) as Target<U>;
    }
}
