export type SpanSpec<Anchor = unknown> = {
    start: number;
    end: number;
    length?: number;
    relativeTo?: Anchor;
} | {
    start: number;
    end?: number;
    length: number;
    relativeTo?: Anchor;
};

/** Reference to a continuous subsection of some string. */
export interface Span<Anchor = unknown> {
    readonly start: number;
    readonly end: number;
    readonly length: number;
    readonly relativeTo: Anchor
}

export interface SpanOwner<Inner, Outer> {
    span(): Span<Outer>;
    span(span: { start: number, end: number }): Span<Outer>;
    span(span: { start: number, length: number }): Span<Outer>;
    translate(span: Span<Inner>): Span<Outer>;
}

/** Reference to a logically continuous subsection of some string. */
export interface MultiSpan<Anchor = unknown> extends Span<Anchor> {
    /**
     * Spans must be ordered by ascending {@link Span#start} then by {@link Span#end}.
     * {@code this.start} must be equal to {@code this.actual[0].start}, and {@code this.end}
     * must be equal to {@code this.actual[this.actual.length - 1].end}.
     *
     * TODO: Allow or disallow overlapping spans?
     *
     * All items in {@link actual} must have {@link Span#relativeTo} equal
     * to {@code this.relativeTo}.
     */
    actual: Span<Anchor>[];
}

export namespace MultiSpan {
    export function flatten<Anchor = unknown>(span: Span<Anchor>): Span<Anchor>[];
    export function flatten<Anchor = unknown>(spans: Span<Anchor>[]): Span<Anchor>[];

    export function flatten<Anchor = unknown>(oneOrMore: Span<Anchor> | Span<Anchor>[]): Span<Anchor>[] {
        const results: Span<Anchor>[] = [];
        if (Array.isArray(oneOrMore)) {
            for (let span of oneOrMore) {
                flattenInto(span, results);
            }
        } else {
            flattenInto(oneOrMore, results);
        }
        return results;
    }

    function flattenInto<Anchor = unknown>(span: (Span<Anchor> & { actual?: undefined }) | MultiSpan<Anchor>, results: Span<Anchor>[]): void {
        if (span.actual === undefined) {
            results.push(span);
        } else if (span.actual.length === 0) {
            throw new Error("MultiSpan.actual must either be undefined or a non-empty array.")
        } else {
            // TODO: Resolve relativeTo: "outer-span"
            for (let childSpan of span.actual) {
                flattenInto(childSpan, results);
            }
        }
    }
}
