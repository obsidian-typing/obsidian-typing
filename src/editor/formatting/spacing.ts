import { NodeMatcherSpec, NodeMatcher } from "./matcher";
import { SpacingSettings } from "./settings";

/**
 * Describes a matcher for the whitespace to be modified.
 *
 * @see {@link SpacingCondition}
 */
export type SpacingConditionSpec<TNodeMatcher = NodeMatcherSpec> = {
    in?: TNodeMatcher,
    inside?: TNodeMatcher,
    parent?: TNodeMatcher,
    within?: TNodeMatcher,
    withinPair?: [TNodeMatcher, TNodeMatcher],
    after?: TNodeMatcher,
    before?: TNodeMatcher,
    around?: TNodeMatcher,
    between?: TNodeMatcher | [TNodeMatcher, TNodeMatcher],
};

/**
 * Describes how a certain section of whitspace should be modified.
 *
 * @see {@link SpacingEffect}
 */
export type SpacingEffectSpec = {
    spaces?: number,
    spaceIf?: boolean,
    lineBreak?: true,
    lineBreakIf?: boolean,
    blankLines?: number,
};

/**
 * Describes a spacing rule.
 *
 * @see {@link SpacingRule}
 */
export type SpacingRuleSpec<TNodeMatcher = NodeMatcherSpec> = SpacingConditionSpec<TNodeMatcher> & SpacingEffectSpec;

/**
 * Describes a collection of spacing rules.
 *
 * @see {@link SpacingRules}
 */
export type SpacingRulesSpec<TNodeMatcher = NodeMatcherSpec> = SpacingRuleSpec<TNodeMatcher>[];

/**
 * Represents a matcher for the whitespace to be modified.
 * Created from a {@link SpacingConditionSpec}.
 */
export class SpacingCondition<TNode> {
    constructor(
        private readonly parent?: NodeMatcher<TNode>,
        private readonly after?: NodeMatcher<TNode>,
        private readonly before?: NodeMatcher<TNode>,
    ) {
    }

    static create<TNode, TNodeMatcher>(
        spec: SpacingConditionSpec<TNodeMatcher>,
        toMatcher: (matcherSpec: TNodeMatcher) => NodeMatcher<TNode>
    ): SpacingCondition<TNode>[] {
        const getMatcher = (matcherSpec: TNodeMatcher | undefined) =>
            matcherSpec === undefined ? undefined : toMatcher(matcherSpec);

        // TODO: Throw when mutually exclusive fields are present together
        let parent = getMatcher(spec.parent ?? spec.in ?? spec.inside ?? spec.within);
        let after = getMatcher(spec.after ?? (spec.between instanceof Array ? spec.between[0] : spec?.between));
        let before = getMatcher(spec.before ?? (spec.between instanceof Array ? spec.between[1] : spec?.between));
        let around = getMatcher(spec.around);
        let withinPairFirst = getMatcher(spec.withinPair?.[0]);
        let withinPairSecond = getMatcher(spec.withinPair?.[1]);

        if (withinPairFirst !== undefined || withinPairSecond !== undefined) {
            return [
                new SpacingCondition(parent, withinPairFirst, undefined),
                new SpacingCondition(parent, undefined, withinPairSecond),
            ];
        }

        if (around !== undefined) {
            return [
                new SpacingCondition(parent, undefined, around),
                new SpacingCondition(parent, around, undefined),
            ];
        }

        return [new SpacingCondition(parent, after, before)];
    }

    matches(parent: TNode, afterChild: TNode, beforeChild: TNode): boolean {
        return ((!this.parent || this.parent.matches(parent)) &&
            (!this.after || this.after.matches(afterChild)) &&
            (!this.before || this.before.matches(beforeChild)));
    }
}

/**
 * Describes how a certain section of whitspace should be modified.
 * Created from a {@link SpacingEffectSpec}.
 */
export class SpacingEffect {
    constructor(private readonly spec: SpacingSpec) {
    }

    static create(settings: SpacingSettings, spec: SpacingEffectSpec): SpacingEffect | null {
        let baseSettings = {
            minSpaces: 0,
            maxSpaces: 0,
            minLineFeeds: 0,
            keepLineBreaks: settings.keepLineBreaks,
            keepBlankLines: settings.keepBlankLines,
        };

        // TODO: Throw when mutually exclusive fields are present together
        if (spec.spaces !== undefined) {
            return new SpacingEffect({
                ...baseSettings,
                minSpaces: spec.spaces,
                maxSpaces: spec.spaces,
            })
        }

        if (spec.spaceIf !== undefined) {
            return new SpacingEffect({
                ...baseSettings,
                minSpaces: spec.spaceIf ? spec.spaces ?? 1 : 0,
                maxSpaces: spec.spaceIf ? spec.spaces ?? 1 : 0,
            })
        }

        if (spec.lineBreak !== undefined) {
            if (spec.lineBreak !== true) {
                throw new Error("lineBreak must be true if set");
            }
            return new SpacingEffect({
                ...baseSettings,
                minLineFeeds: 1,
            })
        }

        if (spec.lineBreakIf !== undefined) {
            if (!spec.lineBreakIf) {
                return null;
            }
            return new SpacingEffect({
                ...baseSettings,
                minLineFeeds: 1,
            })
        }

        if (spec.blankLines !== undefined) {
            return new SpacingEffect({
                ...baseSettings,
                minLineFeeds: spec.blankLines + 1,
            })
        }

        return null;
    }

    /**
     * @param parentRange the range that includes both children blocks (usually the range of the parent block).
     */
    createSpacing(parentRange: { from: number, to: number }): Spacing {
        return Spacing.create(this.spec);
    }
}

/**
 * Represents a spacing rule.
 * Created from a {@link SpacingRuleSpec}.
 */
export class SpacingRule<TNode> {
    constructor(
        private readonly effect: SpacingEffect,
        private readonly condition: SpacingCondition<TNode>,
    ) {
    }

    static create<TNode, TNodeMatcher>(
        settings: SpacingSettings,
        spec: SpacingRuleSpec<TNodeMatcher>,
        toMatcher: (matcherSpec: TNodeMatcher) => NodeMatcher<TNode>
    ): SpacingRule<TNode>[] {
        let effect = SpacingEffect.create(settings, spec);
        if (effect === null) {
            // The spacing rule may be disabled in the current configuration
            return [];
        }

        let conditions = SpacingCondition.create(spec, toMatcher);
        return conditions.map(condition => new SpacingRule(effect, condition));
    }

    matches(parent: TNode | undefined, afterChild: TNode | undefined, beforeChild: TNode | undefined): boolean {
        return parent !== undefined &&
            afterChild !== undefined &&
            beforeChild !== undefined &&
            this.condition.matches(parent, afterChild, beforeChild);
    }

    /**
     * @param parentRange the range that includes both children blocks (usually the range of the parent block).
     */
    createSpacing(parentRange: { from: number, to: number }): Spacing {
        return this.effect.createSpacing(parentRange);
    }
}


/**
 * Represents a collection of spacing rules.
 * Created from a {@link SpacingRulesSpec}.
 */
export class SpacingRules<TNode> {
    constructor(private readonly rules: readonly SpacingRule<TNode>[]) {
    }

    static create<TNode, TNodeMatcher>(
        settings: SpacingSettings,
        rules: SpacingRulesSpec<TNodeMatcher>,
        toMatcher: (matcherSpec: TNodeMatcher) => NodeMatcher<TNode>
    ): SpacingRules<TNode> {
        return new SpacingRules(rules.flatMap(ruleSpec => SpacingRule.create(settings, ruleSpec, toMatcher)));
    }

    concat(other: SpacingRules<TNode>): SpacingRules<TNode> {
        return new SpacingRules([...this.rules, ...other.rules]);
    }

    getSpacing(
        parentRange: { from: number, to: number },
        parent: TNode | null | undefined,
        afterChild: TNode | null | undefined,
        beforeChild: TNode | null | undefined,
    ): Spacing | null {
        for (let rule of this.rules) {
            if (rule.matches(parent ?? undefined, afterChild ?? undefined, beforeChild ?? undefined)) {
                return rule.createSpacing(parentRange);
            }
        }
        return null;
    }
}

export type SpacingSpec = {
    minSpaces: number,
    maxSpaces: number,
    minLineFeeds: number,
    keepLineBreaks: boolean,
    keepBlankLines: number,
};

export class Spacing {
    constructor(public readonly spec: SpacingSpec) {
    }

    get minSpaces(): number {
        return this.spec.minSpaces;
    }

    get maxSpaces(): number {
        return this.spec.maxSpaces;
    }

    get minLineFeeds(): number {
        return this.spec.minLineFeeds;
    }

    get keepLineBreaks(): boolean {
        return this.spec.keepLineBreaks;
    }

    get keepBlankLines(): number {
        return this.spec.keepBlankLines;
    }


    static create(spec: SpacingSpec): Spacing {
        return new Spacing(spec);
    }
}
