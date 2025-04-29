export type IfSameType<A, B, Y, N> = A | B extends A & B ? Y : N;
export type IsSameType<A, B> = IfSameType<A, B, true, never>;
export type AssertSame<A, B> = IfSameType<A, B, true, false>;

// Static tests for IfSameType and IsSameType
namespace StaticTests {
    true satisfies AssertSame<true, true>;
    true satisfies AssertSame<never, never>;
    true satisfies AssertSame<unknown, unknown>;
    true satisfies AssertSame<string, string>;
    true satisfies AssertSame<number, number>;

    false satisfies AssertSame<true, never>;
    false satisfies AssertSame<never, true>;

    false satisfies AssertSame<unknown, never>;
    false satisfies AssertSame<never, unknown>;

    false satisfies AssertSame<string, number>;
    false satisfies AssertSame<unknown, string>;
    false satisfies AssertSame<string, unknown>;
}
