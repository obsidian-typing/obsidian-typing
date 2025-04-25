import { MultiSpan, Span } from "./span";

/** Represents the key of a path segment. */
export type FieldKey = string | number | symbol;

/** Represents the path to the source field of the value being validated. */
export class FieldPath<Key extends FieldKey = FieldKey> implements FieldPath<Key> {
    private constructor(
        public readonly parent: FieldPath | undefined,
        public readonly key: Key,
        public readonly span?: Span | MultiSpan
    ) {
    }

    field<K extends FieldKey = FieldKey>(key: K, span?: Span | MultiSpan): FieldPath<K> {
        return new FieldPath(this, key, span);
    }

    static new(): FieldPath<"">;
    static new<Key extends FieldKey = FieldKey>(parent: FieldPath, key: Key, span?: Span | MultiSpan): FieldPath<Key>;
    static new<Key extends FieldKey = FieldKey>(parent?: FieldPath, key?: Key, span?: Span | MultiSpan): FieldPath<Key> {
        if (parent === undefined && key === undefined) {
            return new FieldPath(undefined, "" as Key, span);
        }
        if (parent === undefined || key === undefined) {
            throw new Error("Either both or none of parent and key are allowed to be undefined.");
        }
        return new FieldPath(parent, key!, span);
    }

    toString(): string {
        if (this.parent === undefined && this.key === "") {
            return "ROOT";
        }
        return `${this.parent}[${String(this.key)}]`
    }
}
