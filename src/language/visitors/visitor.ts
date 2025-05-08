import { Completion, CompletionContext } from "@codemirror/autocomplete";
import { Diagnostic } from "@codemirror/lint";
import { EditorState, Range, Text } from "@codemirror/state";
import { Decoration, EditorView, Tooltip } from "@codemirror/view";
import { NodeWeakMap, SyntaxNode } from "@lezer/common";
import { DataClass, field, log, mergeDeep } from "src/utilities";
import { Merge, OneOf, OverrideObject } from "src/utilities/types";
import { Visitors } from ".";
import { Rules } from "../grammar";
import { Interpreter } from "../interpreter";

export type NodeType = SyntaxNode;

interface CompletionEntry extends Completion {
    symbol?: string;
}

interface CacheEntry {
    callCache: Partial<{
        accept: boolean;
        run: any;
        lint: { diagnostics: Diagnostic[]; hasErrors: boolean };
        complete: CompletionEntry[];
        snippets: CompletionEntry[];
        symbols: Symbol[];
        decorations: Range<Decoration>[];
    }>;
    diagnostics: Diagnostic[];
}

export interface Symbol {
    name: string;
    nameNode: SyntaxNode;
    node: SyntaxNode; // or declNode
    completion?: string;
    // TODO: maybe also some metadata like filename
    // TODO: make metadata generic to allow including `folder` and other attributes to metadata
    metadata?: any;
}

export type VisitorTypes<
    Return = any,
    Children = any,
    Utils = any,
    Cache = any,
    Super = any
> = {
    Return?: Return,
    Children?: Children,
    Utils?: Utils,
    Cache?: Cache,
    Super?: Super
};

export type AnyVisitor<Args extends VisitorTypes = {}> = Visitor<
    OverrideObject<VisitorTypes, Args>["Return"],
    OverrideObject<VisitorTypes, Args>["Children"],
    OverrideObject<VisitorTypes, Args>["Utils"],
    OverrideObject<VisitorTypes, Args>["Cache"],
    OverrideObject<VisitorTypes, Args>["Super"]
>;

export type UnknownVisitor<Args extends VisitorTypes = {}> = Visitor<
    Args["Return"],
    Args["Children"],
    Args["Utils"],
    Args["Cache"],
    Args["Super"]
>;

export type ExactVisitor<Args extends Required<VisitorTypes>> = Visitor<
    Args["Return"],
    Args["Children"],
    Args["Utils"],
    Args["Cache"],
    Args["Super"]
>;

let cache: NodeWeakMap<WeakMap<AnyVisitor, CacheEntry>>;

function resetCache() {
    cache = new NodeWeakMap<WeakMap<AnyVisitor, CacheEntry>>();
}

type CallType = "lint" | "run" | "complete" | "accept" | "symbols" | "snippets" | "decorations" | "hover";
type InternalCallType = CallType | "traverse";

interface StackFrame {
    node: SyntaxNode;
    visitor: AnyVisitor;
    context: LocalContext;
    call: InternalCallType;
}

export interface GlobalCallContext {
    input?: string;
    doc?: Text;
    state?: EditorState;
    interpreter: Interpreter;
    path?: string;
}

interface GlobalContext {
    callStack: StackFrame[];
    callContext: GlobalCallContext;
    callCount: Partial<Record<string, number>>;
}

interface LocalContext {
    node: SyntaxNode;
}

interface TraversalOptions<Key> {
    visitTop?: boolean;
    visitChildren?: boolean;
    exitCriterion?: () => boolean;
    skipAlways?: string[],
    skipUnmatched?: string[],
    nodeFilter?: (node: SyntaxNode) => boolean;
    selectChildren?: Key[];
    callbackNotAccepted?: (node: SyntaxNode) => void;
    // order?: "bynodes" | "bychildren"; // or "bycursor"
}

interface VisitorOptions {
    cache?: {
        accept?: boolean;
        run?: boolean;
        lint?: boolean;
        complete?: boolean;
        symbols?: boolean;
        decorations?: boolean;
    };
    traversal?: TraversalOptions<any>;
}

const defaultVisitorOptions: VisitorOptions = {
    cache: { accept: true, run: true, lint: true, complete: false, symbols: true, decorations: true },
    traversal: {
        visitTop: false,
        visitChildren: true,
        skipUnmatched: ["Delimiter"],
    },
};

export type VisitorArgs_Infer<
    Return, Children, Utils, Cache, Super,
    This extends Visitor<Return, Children, Utils, Cache, Super> = Visitor<Return, Children, Utils, Cache, Super>
> = VisitorArgs<Return, Children, Utils, Cache, Super, This>;

// TODO: add Symbol as template arg to support custom symbols (ext Symbol)
export interface VisitorArgs<Return, Children, Utils, Cache, Super, This> {
    // TODO: probably should rename to `node`(s) or `nodetype`(s) or `nodeType`(s), `Rules` -> `NodeType`
    rules?: Rules | Rules[];
    tags?: string[];

    accept?: (this: This, node: NodeType) => boolean;

    run?: (this: This, node: NodeType) => Return;

    lint?: (this: This, node: NodeType) => void;

    complete?: (this: This, node: NodeType, context: CompletionContext) => CompletionEntry[] | null;

    snippets?: (this: This) => CompletionEntry[] | null;

    symbols?: (this: This, node: NodeType) => Symbol[] | null; // or exports

    // TODO: support formatting (low priority)
    format?: (this: This, node: NodeType) => string;

    hover?: (this: This, node: NodeType, pos: number) => Tooltip | null;

    decorations?: (this: This, node: NodeType, view: EditorView) => Range<Decoration>[];

    children?: Children;
    utils?: Utils & ThisType<This>;

    options?: VisitorOptions;
    // cache?: () => CacheType;
}

export type TReturnBase = any;
export type TUtilsBase = Record<string, any>;
export type TChildrenBase = Record<string, AnyVisitor>;
export type TCacheBase = any;

export type TVisitorArgsBase<
    Return extends TReturnBase = any,
    Children extends TChildrenBase = any,
    Utils extends TUtilsBase = any,
    Cache extends TCacheBase = any
> = VisitorArgs<Return, Children, Utils, Cache, TNoVisitor, AnyVisitor>;

type TNoVisitor = any;

type Children_<Children> = Children & Record<string, Pick<UnknownVisitor,
    "run" | "enter" | "exit" | "hasDecorations" | "hasHover" | "hasLint" | "decorations" | "hover" | "lint" | "complete"
>>;

type VisitorReturn<Key extends keyof Children, Children> =
    Partial<{ [K in Key]: ReturnType<Children_<Children>[K]["run"]> }>;

export class Visitor<Return, Children, Utils, Cache, Super> extends DataClass {
    @field()
    args!: VisitorArgs<Return, Children, Utils, Cache, Super, any>;

    super: Super = null as any;
    derived?: AnyVisitor;
    isInitialized: boolean = false;

    originalArgs!: VisitorArgs<Return, Children, Utils, Cache, Super, any>;
    hasDecorations: boolean = false;
    childrenWithDecorations: (keyof Children)[] = [];
    hasHover: boolean = false;
    childrenWithHover: (keyof Children)[] = [];
    hasLint: boolean = false;
    childrenWithLint: (keyof Children)[] = [];

    get rules() {
        return this.args.rules;
    }
    get tags() {
        return this.args.tags;
    }
    get children(): Children_<Children> {
        return this.args.children! as Children_<Children>;
    }
    get utils() {
        return this.args.utils!;
    }
    get options() {
        // TODO: This is not correct, this.args.options may actually be undefined
        return this.args.options!;
    }

    static fromArgs<
        Return,
        Children extends TChildrenBase,
        Utils extends TUtilsBase,
        Cache,
        Super extends AnyVisitor,
        This extends Visitor<Return, Children, Utils, Cache, Super> = Visitor<
            Return,
            Children,
            Utils,
            Cache,
            Super
        >
    >(
        args: VisitorArgs<Return, Children, Utils, Cache, Super, This>
    ): ExactVisitor<{
        Return: Return,
        Children: Children,
        Utils: Utils,
        Cache: Cache,
        Super: Super
    }> {
        return Visitor.new<Visitor<Return, Children, Utils, Cache, Super>>({
            args: args,
        });
    }

    static fromArgs2<Return, Children, Utils, Cache, Super, This extends Visitor<Return, Children, Utils, Cache, Super> = Visitor<Return, Children, Utils, Cache, Super>>(
        args: VisitorArgs<Return, Children, Utils, Cache, Super, This>
    ): ExactVisitor<{
        Return: Return,
        Children: Children,
        Utils: Utils,
        Cache: Cache,
        Super: Super
    }> {
        return Visitor.new<Visitor<Return, Children, Utils, Cache, Super>>({
            // Ignore the fact that `This` might be different type
            // than the one specified in the type parameter default
            args: args as any,
        });
    }

    override<
        NewReturn = unknown,
        NewChildren = unknown,
        NewUtils = unknown,
        NewCache = unknown,
        NewSuper extends Visitor<Return, Children, Utils, Cache, Super> = Visitor<Return, Children, Utils, Cache, Super>,
        NewThis extends Visitor<
            OneOf<Return, NewReturn>,
            OneOf<Children, NewChildren>,
            OneOf<Utils, NewUtils>,
            OneOf<Cache, NewCache>,
            NewSuper
        > = Visitor<OneOf<Return, NewReturn>, OneOf<Children, NewChildren>, OneOf<Utils, NewUtils>, OneOf<Cache, NewCache>, NewSuper>,
        Args extends VisitorArgs<
            NewReturn,
            NewChildren,
            NewUtils,
            NewCache,
            NewSuper,
            NewThis
        > = VisitorArgs<NewReturn, NewChildren, NewUtils, NewCache, NewSuper, NewThis>
    >(args: Args): ExactVisitor<{
        Return: ReturnType<Exclude<Args["run"], undefined>>,
        Children: OneOf<Children, NewChildren>,
        Utils: OneOf<Utils, NewUtils>,
        Cache: OneOf<Cache, NewCache>,
        Super: NewSuper,
    }> {
        let newArgs = Object.assign({}, this.originalArgs, args);
        let result = Visitor.fromArgs2<ReturnType<Exclude<Args["run"], undefined>>, OneOf<Children, NewChildren>, OneOf<Utils, NewUtils>, OneOf<Cache, NewCache>, NewSuper>(newArgs as any);
        result.super = Visitor.fromArgs2<Return, Children, Utils, Cache, Super>(this.originalArgs as any) as NewSuper;
        result.super.derived = result;
        result.super.bind(result);
        return result;
    }

    extend<
        NewReturn = unknown,
        NewChildren = unknown,
        NewUtils = unknown,
        NewCache = unknown,
        NewSuper extends Visitor<Return, Children, Utils, Cache, Super> = Visitor<
            Return,
            Children,
            Utils,
            Cache,
            Super
        >,
        NewThis extends Visitor<
            OneOf<Return, NewReturn>,
            NewChildren extends TChildrenBase ? Merge<Children, NewChildren> : Children,
            NewUtils extends TUtilsBase ? Merge<Utils, NewUtils> : Utils,
            Merge<Cache, NewCache>,
            NewSuper
        > = Visitor<
            OneOf<Return, NewReturn>,
            NewChildren extends TChildrenBase ? Merge<Children, NewChildren> : Children,
            NewUtils extends TUtilsBase ? Merge<Utils, NewUtils> : Utils,
            Merge<Cache, NewCache>,
            NewSuper
        >
    >(
        args: VisitorArgs<NewReturn, NewChildren, NewUtils, NewCache, NewSuper, NewThis>
    ): ExactVisitor<{
        Return: OneOf<Return, NewReturn>,
        Children: NewChildren extends TChildrenBase ? Merge<Children, NewChildren> : Children,
        Utils: NewUtils extends TUtilsBase ? Merge<Utils, NewUtils> : Utils,
        Cache: Merge<Cache, NewCache>,
        Super: NewSuper
    }> {
        // let newArgs = mergeDeep(this.originalArgs, args); // BUG: could probably merge internal visitors too
        let newArgs = Object.assign({}, this.originalArgs, args);
        newArgs.children = Object.assign({}, this.originalArgs.children, args.children);
        newArgs.utils = Object.assign({}, this.originalArgs.utils, args.utils);
        let result = Visitor.fromArgs2<
            OneOf<Return, NewReturn>,
            NewChildren extends TChildrenBase ? Merge<Children, NewChildren> : Children,
            NewUtils extends TUtilsBase ? Merge<Utils, NewUtils> : Utils,
            Merge<Cache, NewCache>,
            NewSuper
        >(newArgs as any);
        result.super = Visitor.fromArgs2<Return, Children, Utils, Cache, Super>(this.originalArgs as any) as NewSuper;
        result.super.derived = result;
        result.super.bind(result);
        return result;
    }

    bind(to?: AnyVisitor): void {
        to = to ?? this;

        this.args.children = this.originalArgs.children ?? ({} as Children);
        this.args.utils = this.originalArgs.utils ?? ({} as Utils & ThisType<any>);

        this.args.accept = this.originalArgs.accept?.bind(this);
        this.args.run = this.originalArgs.run?.bind(this);
        this.args.lint = this.originalArgs.lint?.bind(this);
        this.args.complete = this.originalArgs.complete?.bind(this);
        this.args.snippets = this.originalArgs.snippets?.bind(this);
        this.args.symbols = this.originalArgs.symbols?.bind(this);
        this.args.format = this.originalArgs.format?.bind(this);
        this.args.hover = this.originalArgs.hover?.bind(this);
        this.args.decorations = this.originalArgs.decorations?.bind(this);

        if (this.args.utils) {
            for (let key in this.args.utils) {
                if (this.args.utils[key] != null) {
                    try {
                        this.args.utils[key] = (this.args.utils[key] as any as Function).bind(this);
                    } catch { }
                }
            }
        }
    }

    onAfterCreate(): void {
        this.originalArgs = Object.assign({}, this.args);

        this.bind();

        // TODO: fix
        this.args.options = this.args.options ?? {};
        this.args.options = mergeDeep(defaultVisitorOptions, this.args.options);

        // HACK(sad one): because we can't keep cache between runs, we can cache everything
        this.args.options.cache = defaultVisitorOptions.cache;

        this.hasDecorations = this.args.decorations != null;
        for (let key in this.children) {
            let x = this.children[key];
            if (this.children[key].hasDecorations) {
                this.hasDecorations = true;
                this.childrenWithDecorations.push(key as keyof Children);
            }
        }

        this.hasHover = this.args.hover != null;
        for (let key in this.children) {
            if (this.children[key].hasHover) {
                this.hasHover = true;
                this.childrenWithHover.push(key as keyof Children);
            }
        }

        this.hasLint = this.args.lint != null;
        for (let key in this.children) {
            if (this.children[key].hasLint) {
                this.hasLint = true;
                this.childrenWithLint.push(key as keyof Children);
            }
        }
    }
    // CONTEXT {

    static globalContexts: GlobalContext[] = [];

    get globalContext() {
        // TODO: Assert that a traversal is in progress and thus globalContexts is not empty
        return Visitor.globalContexts.last()!;
    }

    get localContext() {
        // TODO: very tricky and unobvious shit, should probably come up with something else
        let index = this.globalContext.callStack.length - 1;
        while (index > 0 && this.globalContext.callStack[index].visitor !== this.ref) {
            index--;
        }
        return this.globalContext.callStack[index].context;
    }

    get node() {
        return this.localContext.node;
    }

    get callContext() {
        return this.globalContext.callContext;
    }

    setCallContext(callContext?: GlobalCallContext) {
        if (callContext === null || callContext === undefined) {
            return;
        }

        // TODO: temporarily flush cache each call
        resetCache();

        Visitor.globalContexts.push({ callContext, callStack: [], callCount: {} });
    }

    teardownCallContext() {
        Visitor.globalContexts.pop();
    }

    // } CONTEXT

    // MAIN {

    accept(node: NodeType): boolean {
        this.enter(node, "accept");
        let cached = this.getCachedResult("accept");
        if (cached !== undefined) return cached;

        let result = true;
        if (Array.isArray(this.rules)) {
            result = this.rules.contains(node.name as Rules);
        } else if (this.rules != null) {
            result = this.rules == node.name;
        }

        if (result) {
            result = this.runFunc("accept", [node], true);
        }

        this.cacheResult("accept", result);
        this.exit();
        return result;
    }

    // TODO
    // format(node: NodeType): string {}

    lint(node: NodeType, callContext?: GlobalCallContext): { diagnostics: Diagnostic[]; hasErrors: boolean } {
        if (!this.hasLint) {
            return { diagnostics: [], hasErrors: false };
        }
        if (!this.enter(node, "lint", callContext)) {
            return { diagnostics: [], hasErrors: true }; // TODO: is it hasErrors: true? looks like this shouldn't have any errors
        }
        let cached = this.getCachedResult("lint");
        if (cached !== undefined) return cached;

        let diagnostics = this.lintChildren().diagnostics;

        this.cacheContainer(node).diagnostics = [];
        this.runFunc("lint", [node]);

        diagnostics.push(...this.cacheContainer(node).diagnostics);
        let result = { diagnostics, hasErrors: diagnostics.some((value) => value.severity == "error") };

        this.cacheResult("lint", result);
        this.exit();
        return result;
    }

    lintChildren(traversalOptions?: TraversalOptions<keyof Children>) {
        let result: ReturnType<AnyVisitor["lint"]> = { diagnostics: [], hasErrors: false };

        if (!this.childrenWithLint.length) return result;

        traversalOptions = traversalOptions ?? {};
        traversalOptions = mergeDeep({ selectChildren: this.childrenWithLint }, traversalOptions);

        this.traverse((node, child) => {
            let tmp = child.lint(node);
            result.diagnostics.push(...tmp.diagnostics);
            result.hasErrors ||= tmp.hasErrors;
        }, traversalOptions);

        return result;
    }

    complete(node: NodeType, context: CompletionContext, callContext?: GlobalCallContext): CompletionEntry[] | null {
        if (!this.enter(node, "complete", callContext)) return null;

        let childCompletions = this.completeChildren(node, context);
        let result = null;
        if (childCompletions != null) {
            result = childCompletions;
        }
        if (result == null) {
            result = this.runFunc("complete", [node, context], null);
        }

        this.exit();
        return result;
    }

    completeChildren(node: SyntaxNode, context: CompletionContext) {
        let result: CompletionEntry[] | null = null;

        this.traverse(
            (node, child) => {
                let completions = child.complete(node, context);
                if (completions != null) {
                    result = completions;
                }
            },
            {
                nodeFilter: (node) => {
                    if (context) {
                        return node.from <= context.pos && context.pos <= node.to;
                    }
                    return true;
                },
                exitCriterion: () => {
                    return result != null;
                },
            }
        );

        return result;
    }

    decorations(node: NodeType, view: EditorView, callContext?: GlobalCallContext) {
        if (!this.hasDecorations) return [];
        if (!this.enter(node, "decorations", callContext)) return [];
        // NOTE: disabled caching because it messes positions
        // let cached = this.getCachedResult("decorations");
        // if (cached !== undefined) return cached;

        let result = this.decorateChildren(node, view);
        let decorations = this.runFunc("decorations", [node, view], []);
        if (decorations) result.push(...decorations);

        // this.cacheResult("decorations", result);
        this.exit();
        return result;
    }

    decorateChildren(node: SyntaxNode, view: EditorView) {
        let result: Range<Decoration>[] = [];

        if (!this.childrenWithDecorations.length) return result;

        this.traverse(
            (node, child) => {
                result.push(...child.decorations(node, view));
            },
            {
                selectChildren: this.childrenWithDecorations,
            }
        );

        return result;
    }

    hover(node: NodeType, pos: number, callContext?: GlobalCallContext): Tooltip | null {
        if (!this.hasHover) return null;
        if (!this.enter(node, "hover", callContext)) return null;

        let childCompletions = this.hoverChildren(node, pos);
        let result = null;
        if (childCompletions != null) {
            result = childCompletions;
        }
        if (result == null) {
            result = this.runFunc("hover", [node, pos], null);
        }

        this.exit();
        return result;
    }

    hoverChildren(node: SyntaxNode, pos: number) {
        let result: Tooltip | null = null;

        if (!this.childrenWithHover.length) return result;

        this.traverse(
            (node, child) => {
                let completions = child.hover(node, pos);
                if (completions != null) {
                    result = completions;
                }
            },
            {
                nodeFilter: (node) => {
                    return node.from <= pos && pos <= node.to;
                },
                exitCriterion: () => {
                    return result != null;
                },
                selectChildren: this.childrenWithHover,
            }
        );

        return result;
    }

    run(node: NodeType, callContext?: GlobalCallContext): Return {
        if (!this.enter(node, "run", callContext)) return null as Return;
        if (this.lint(node).hasErrors) {
            this.exit();
            return null as Return;
        }
        let cached = this.getCachedResult("run");
        if (cached !== undefined) return cached;

        // TODO: if has custom `run`, then use it
        // otherwise return `runChildren`, should also fix typing
        let result = this.runFunc("run", [node], null);

        this.cacheResult("run", result);
        this.exit();
        return result as Return;
    }

    runChildren<Key extends keyof Children>(options?: {
        keys?: Key[] | null;
        eager?: boolean;
        traversalOptions?: TraversalOptions<Key>;
    }): VisitorReturn<Key, Children> {
        options = options ?? {};
        // options = mergeDeep({ keys: [], eager: false, traversalOptions: {} }, options);

        let result = {} as VisitorReturn<Key, Children>;
        let traversalOptions = { ...options.traversalOptions };
        traversalOptions.selectChildren = options?.keys ?? undefined;

        let fulfilledKeys: Set<Key>;
        if (options?.eager) {
            fulfilledKeys = new Set();
            traversalOptions.exitCriterion = () => {
                return fulfilledKeys.size === options?.keys?.length;
            };
        }

        this.traverse((node, child, key) => {
            let res = child.run(node) as ReturnType<Children_<Children>[typeof key]["run"]>;
            if (res !== null && res !== undefined) {
                result[key] = res;
                if (options?.eager) fulfilledKeys.add(key);
            }
        }, traversalOptions);
        return result;
    }

    runChild<Key extends keyof Children>(key: Key): ReturnType<Children_<Children>[Key]["run"]> | undefined {
        return this.runChildren({ keys: [key] })[key];
    }

    snippets(): CompletionEntry[] {
        return this.runFunc("snippets", [], null) ?? [];
    }

    symbols(node: NodeType): Symbol[] | null {
        if (!this.enter(node, "symbols")) return null;
        let cached = this.getCachedResult("symbols");
        if (cached !== undefined) return cached;

        let result = this.runFunc("symbols", [node]);

        this.cacheResult("symbols", result ?? undefined);
        this.exit();
        return result ?? null;
    }

    rebase(node: NodeType): NodeType {
        return node;
        // TODO
        // if (!this._rebase) return node;
        // return this._rebase(node);
    }

    // } MAIN

    // TRAVERSAL {

    visit<Key extends keyof Children = keyof Children>(
        node: SyntaxNode,
        callback: (node: SyntaxNode, child: Children_<Children>[Key], key: Key) => void,
        keys: Key[]
    ): boolean {
        for (let key of keys) {
            let child = this.children[key];
            if (child.enter(node.node, "traverse")) {
                try {
                    callback(node.node, child, key);
                } catch (e) {
                    log.error("Traversal callback error", { e, node, child, key, callback });
                }
                child.exit();
                return true;
            }
        }
        return false;
    }

    traverse<Key extends keyof Children = keyof Children>(
        callback: (node: SyntaxNode, child: Children_<Children>[Key], key: Key) => void,
        options?: TraversalOptions<Key>
    ): void {
        options = options ? mergeDeep(this.options.traversal, options) : this.options.traversal;
        if (!options) {
            throw new Error("Traversal error:" +
                " No TraversalOptions have been provided to Visitor.traverse()." +
                " Use visitor.traverse(..., traversalOptions)" +
                " or createVisitor({ options: { traversal: traversalOptions } })" +
                " to provide the traversal settings.");
        }

        let activeChildren: Key[] = [];
        if (options.selectChildren) {
            activeChildren = options.selectChildren;
        } else {
            activeChildren = Object.keys(this.children) as Key[];
        }

        let cursor = this.node.cursor();
        if (options.visitTop) {
            let success = this.visit(cursor.node, callback, activeChildren);
            if (!success && options.callbackNotAccepted) {
                try {
                    options.callbackNotAccepted(cursor.node);
                } catch (e) {
                    log.error("Traversal callback error: callbackNotAccepted", { e, callback });
                }
            }
        }
        if (options.visitChildren) {
            if (cursor.firstChild()) {
                do {
                    if (options.exitCriterion && options.exitCriterion()) break;
                    if (options.skipAlways && options.skipAlways.some(skippedType => cursor.type.is(skippedType))) continue;
                    if (options.nodeFilter && !options.nodeFilter(cursor.node)) continue;
                    let success = this.visit(cursor.node, callback, activeChildren);
                    if (!success && options.skipUnmatched && options.skipUnmatched.some(skippedType => cursor.type.is(skippedType))) continue;
                    if (!success && options.callbackNotAccepted) {
                        try {
                            options.callbackNotAccepted(cursor.node);
                        } catch (e) {
                            log.error("Traversal callback error: callbackNotAccepted", { e, callback });
                        }
                    }
                } while (cursor.nextSibling());
            }
        }
    }

    enter(node: NodeType, call: InternalCallType, callContext?: GlobalCallContext): boolean {
        if (callContext) {
            this.setCallContext(callContext);
        }

        this._enter(node, call);

        if (call == "accept" || this.accept(node)) {
            return true;
        } else {
            this.exit();
            return false;
        }
    }

    _enter(node: NodeType, call: InternalCallType): void {
        if (!this.globalContext) {
            throw new Error("Global context not set!");
        }
        this.globalContext.callCount[call] = (this.globalContext.callCount[call] ?? 0) + 1;
        this.globalContext.callStack.push({
            visitor: this,
            node: node.node,
            context: {
                node: node.node,
            },
            call,
        });
    }

    exit(cached?: boolean): void {
        let lastContext = this.globalContext.callStack.pop();
        if (!lastContext) {
            throw new Error("Exiting while no traversal is in progress.");
        }
        if (cached) {
            let call = lastContext.call + "_cached";
            this.globalContext.callCount[call] = (this.globalContext.callCount[call] ?? 0) + 1;
        }
        if (lastContext.visitor !== this) {
            throw new Error("Exiting not the same visitor as entered.");
        }
        if (!this.globalContext.callStack.length) {
            this.teardownCallContext();
        }
    }

    // } TRAVERSAL

    // DIAGNOSTICS {

    joinDiagnostics(diagnostics: Diagnostic[]) {
        this.cacheContainer().diagnostics.push(...diagnostics);
    }

    diagnostics(severity: "error" | "warning" | "info", message: string | Partial<Diagnostic>, node?: NodeType | null) {
        node = node ?? this.node;
        let diagnostic: Partial<Diagnostic>;
        if (typeof message == "string") {
            diagnostic = { from: node.from, to: node.to, severity, message };
        } else {
            diagnostic = message;
            diagnostic.from = diagnostic.from ?? node.from;
            diagnostic.to = diagnostic.to ?? node.to;
            diagnostic.severity = diagnostic.severity ?? severity;
        }
        this.cacheContainer().diagnostics.push(diagnostic as Diagnostic);
    }

    error(message: string | Partial<Diagnostic>, node?: NodeType | null) {
        // TODO: path?
        this.diagnostics("error", message, node);
    }

    warning(message: string | Partial<Diagnostic>, node?: NodeType | null) {
        this.diagnostics("warning", message, node);
    }

    info(message: string | Partial<Diagnostic>, node?: NodeType | null) {
        this.diagnostics("info", message, node);
    }

    // } DIAGNOSTICS

    // TEXT {

    getChildText(name?: string) {
        let node = name ? this.node.getChild(name) : this.node;
        if (!node) throw new Error("Failed to get text: Node not found");
        return this.getNodeText(node);
    }

    getNodeText(node: { from: number; to: number }) {
        if (this.callContext.input) return this.callContext.input.slice(node.from, node.to);
        if (this.callContext.doc) return this.callContext.doc.sliceString(node.from, node.to);
        if (this.callContext.state) return this.callContext.state.sliceDoc(node.from, node.to);
        if (this.callContext.interpreter?.activeModule)
            return this.callContext.interpreter.activeModule.file.source.slice(node.from, node.to);
        throw Error();
    }

    // } TEXT

    // CACHE {

    // get cache(): CacheType {
    //     return this.cacheContainer.public;
    // }

    getCachedResult<K extends keyof NonNullable<VisitorOptions["cache"]>>(
        call: K,
        opts?: { exitOnHit: boolean }
    ): CacheEntry["callCache"][K] {
        opts = opts ?? { exitOnHit: true };
        let shouldUseCache = this.options.cache?.[call];
        if (shouldUseCache) {
            let cached = this.callCache[call];
            if (cached !== undefined) {
                if (opts.exitOnHit) this.exit(true);
                return cached;
            }
        }
        return undefined;
    }

    cacheResult<K extends keyof NonNullable<VisitorOptions["cache"]>>(call: K, result: CacheEntry["callCache"][K]) {
        let shouldUseCache = this.options.cache?.[call];
        if (shouldUseCache) {
            this.callCache[call] = result;
        }
    }

    get callCache() {
        return this.cacheContainer().callCache;
    }

    cacheContainer(node?: NodeType): CacheEntry {
        let ref = this.ref;
        node = node ?? ref.node;
        let visitorCache = cache.get(node);
        if (visitorCache == null) {
            visitorCache = new WeakMap<AnyVisitor, CacheEntry>();
            cache.set(node, visitorCache);
        }
        let container = visitorCache.get(ref);
        if (container == null) {
            container = {
                callCache: {
                    lint: undefined,
                    run: undefined,
                    complete: undefined,
                    snippets: undefined,
                    accept: undefined,
                    symbols: undefined,
                    decorations: undefined,
                },
                diagnostics: [],
            };
            visitorCache.set(ref, container);
        }
        return container;
    }

    get ref(): AnyVisitor {
        return this.derived ?? this;
    }

    // get cacheDefault(): CacheType {
    //     if (this.args.cache != null) {
    //         return this.args.cache();
    //     }
    //     return {} as CacheType;
    // }

    // } CACHE

    getParent<R extends Rules>({ tags, rules }: { tags?: string[]; rules?: R }): AnyVisitor | null {
        for (let i = this.globalContext.callStack.length - 1; i >= 0; i--) {
            let visitor = this.globalContext.callStack[i].visitor;
            if (tags && visitor.tags) {
                for (let tag of tags) {
                    if (visitor.tags.contains(tag)) {
                        return visitor as VisitorWithRule<R>;
                    }
                }
            }
            if (rules && visitor.rules) {
                let visitorRules = visitor.rules instanceof Array ? visitor.rules : [visitor.rules];
                for (let rule of rules) {
                    if (visitorRules.contains(rule as Rules)) {
                        return visitor as VisitorWithRule<R>;
                    }
                }
            }
        }
        return null;
    }

    runFunc<K extends CallType, Args extends VisitorArgs_Infer<Return, Children, Utils, Cache, Super>>(
        call: K,
        args: Parameters<NonNullable<Args[K]>>,
        defaultReturn: ReturnType<NonNullable<Args[K]>>
    ): ReturnType<NonNullable<Args[K]>>;

    runFunc<K extends CallType, Args extends VisitorArgs_Infer<Return, Children, Utils, Cache, Super>>(
        call: K,
        args: Parameters<NonNullable<Args[K]>>,
        defaultReturn: null
    ): ReturnType<NonNullable<Args[K]>> | null;

    runFunc<K extends CallType, Args extends VisitorArgs_Infer<Return, Children, Utils, Cache, Super>>(
        call: K,
        args: Parameters<NonNullable<Args[K]>>,
        defaultReturn: undefined
    ): ReturnType<NonNullable<Args[K]>> | undefined;

    runFunc<K extends CallType, Args extends VisitorArgs_Infer<Return, Children, Utils, Cache, Super>>(
        call: K,
        args: Parameters<NonNullable<Args[K]>>,
        defaultReturn?: ReturnType<NonNullable<Args[K]>>
    ): ReturnType<NonNullable<Args[K]>> | undefined;

    runFunc<K extends CallType, Args extends VisitorArgs_Infer<Return, Children, Utils, Cache, Super>>(
        call: K,
        args: Parameters<NonNullable<Args[K]>>,
        defaultReturn?: ReturnType<NonNullable<Args[K]>>
    ): ReturnType<NonNullable<Args[K]>> | undefined {
        const func = this.args[call] as null | undefined | ((...args: Parameters<NonNullable<Args[K]>>) => ReturnType<NonNullable<Args[K]>>);
        if (func !== null && func !== undefined) {
            try {
                return func(...args);
            } catch (e) {
                log.error(`runFunc ${call} error`, { e, call, args, defaultReturn, func, this: this });
                this.error(`Visitor.${call}() failed.`);
            }
        }
        return defaultReturn;
    }
}

type VisitorWithRule<R extends Rules> = {
    [K in keyof typeof Visitors]: (typeof Visitors)[K] extends { rules: R } ? (typeof Visitors)[K] : never;
}[keyof typeof Visitors];

export const createVisitor = Visitor.fromArgs;
