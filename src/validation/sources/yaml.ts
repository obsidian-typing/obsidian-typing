import {
    isAlias, isMap, isScalar, isSeq,
    Alias as YAMLAlias,
    Document as YAMLDocument,
    YAMLMap as YAMLMap,
    Node as YAMLNode,
    Scalar as YAMLScalar,
    YAMLSeq as YAMLSeq,
} from "yaml";
import { FieldKey, FieldPath as Path, FieldOrigin } from "../reporting";
import { ValidationContext as Ctx } from "../validation_context";
import { FieldsAsTargets, ValueSourceWithContext } from "./base";

export function yamlSource<T = unknown>(node: undefined, doc: YAMLDocument, path: Path, context: Ctx): undefined;
export function yamlSource<T = unknown>(node: YAMLNode, doc: YAMLDocument, path: Path, context: Ctx): ValueSourceWithContext<T>;

export function yamlSource<T = unknown>(node: YAMLNode | undefined, doc: YAMLDocument, path: Path, context: Ctx): ValueSourceWithContext<T> | undefined {
    return YamlSource.from(node, doc, path, context);
}

abstract class YamlSource<T> extends ValueSourceWithContext<T> {
    constructor(
        public readonly doc: YAMLDocument,
        path: Path,
        context: Ctx
    ) {
        super(path, context);
    }

    abstract readonly node: YAMLNode;

    get providerName(): string {
        return "yaml";
    }

    get location(): FieldOrigin {
        let [start, end] = this.node.range ?? [0, 0];
        return {
            path: this.path,
            span: {
                start: start,
                end: end,
                length: end - start,
                relativeTo: this
            }
        }
    }

    static from<T = unknown>(node: YAMLNode, doc: YAMLDocument, path: Path, context: Ctx): YamlSource<T>;
    static from<T = unknown>(node: YAMLNode | undefined, doc: YAMLDocument, path: Path, context: Ctx): YamlSource<T> | undefined;
    static from<T = unknown>(node: YAMLNode | undefined, doc: YAMLDocument, path: Path, context: Ctx): YamlSource<T> | undefined {
        // NOTE: `null` is a valid value for a field (and can be written in YAML),
        //       while `undefined` indicates the absencence of a field.
        if (node === undefined) {
            return undefined;
        } else if (isScalar(node)) {
            return new YamlScalarData<T>(node as YAMLScalar<T>, doc, path, context);
        } else if (isMap(node)) {
            return new YamlMapData<T>(node as YAMLMap<keyof T>, doc, path, context);
        } else if (isSeq(node)) {
            return new YamlSeqData<T>(node as YAMLSeq, doc, path, context);
        } else if (isAlias(node)) {
            return new YamlAliasData(node as YAMLAlias, doc, path, context);
        } else {
            throw new Error("Internal Error: Unsupported YAML node type");
        }
    }

    protected fieldBase<U = unknown>(node: YAMLNode, key: FieldKey): YamlSource<U>;
    protected fieldBase<U = unknown>(node: YAMLNode | undefined, key: FieldKey): YamlSource<U> | undefined;
    protected fieldBase<U = unknown>(node: YAMLNode | undefined, key: FieldKey): YamlSource<U> | undefined {
        return YamlSource.from(
            node,
            this.doc,
            Path.new(this.path, key),
            this.context
        );
    }
}

class YamlScalarData<T = unknown> extends YamlSource<T> {
    constructor(
        public readonly scalar: YAMLScalar<T>,
        doc: YAMLDocument,
        path: Path,
        context: Ctx
    ) {
        super(doc, path, context);
    }

    get node() {
        return this.scalar;
    }

    get value(): T {
        return this.scalar.value;
    }

    field<K extends keyof T>(key: K): FieldsAsTargets<T>[K] {
        return undefined as unknown as FieldsAsTargets<T>[K];
    }
}

class YamlMapData<T = unknown> extends YamlSource<T> {
    constructor(
        public readonly map: YAMLMap<keyof T>,
        doc: YAMLDocument,
        path: Path,
        context: Ctx
    ) {
        super(doc, path, context);
    }

    get node() {
        return this.map;
    }

    get value(): T {
        return YamlMapData.proxyFor(this.map);
    }

    static proxyFor(map: YAMLMap): any {
        return new Proxy<any>({}, {
            get(target, key, receiver) {
                map.get(key, true)
            },
        })
    }

    field<K extends keyof T>(key: K): FieldsAsTargets<T>[K] {
        return this.fieldBase(this.map.get(key, true), key) as FieldsAsTargets<T>[K];
    }
}

class YamlSeqData<T = unknown> extends YamlSource<T> {
    constructor(
        public readonly seq: YAMLSeq,
        doc: YAMLDocument,
        path: Path,
        context: Ctx
    ) {
        super(doc, path, context);
    }

    get node() {
        return this.seq;
    }

    get value(): T {
        return YamlSeqData.proxyFor(this.seq);
    }

    static proxyFor(seq: YAMLSeq): any {
        return new Proxy<any>([], {
            get(target, key, receiver) {
                seq.get(key, true)
            },
        })
    }

    field<K extends keyof T>(key: K): FieldsAsTargets<T>[K] {
        return this.fieldBase(this.seq.get(key, true), key) as FieldsAsTargets<T>[K];
    }
}

class YamlAliasData<T = unknown> extends YamlSource<T> {
    resolvedNode?: YAMLNode;
    resolvedSource?: YamlSource<T>;

    constructor(
        public readonly alias: YAMLAlias,
        doc: YAMLDocument,
        path: Path,
        context: Ctx
    ) {
        super(doc, path, context);
        this.resolvedNode = this.alias.resolve(this.doc);
        this.resolvedSource = YamlSource.from<T>(this.resolvedNode, doc, path, context);
    }

    get node() {
        return this.alias ?? this.resolvedNode;
    }

    get value(): T {
        // TODO: Review how to handle a failed resolution
        return this.resolvedSource ? this.resolvedSource.value : undefined as any;
    }

    field<K extends keyof T>(key: K): FieldsAsTargets<T>[K] {
        // TODO: Review handling of undefined
        return this.resolvedSource?.field(key) ?? undefined as any;
    }
}
