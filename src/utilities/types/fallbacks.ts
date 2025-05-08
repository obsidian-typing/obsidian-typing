import { AssertSame, Expand, IsUnknown } from ".";

export type Merge<A, B> = IsUnknown<B> extends never ? IsUnknown<A> extends never ? A & B : B : A;
export type OneOf<A, B> = IsUnknown<B> extends never ? B : A;

// Static tests of Merge and OneOf
namespace StaticTests {
    true satisfies AssertSame<Merge<string, number>, string & number>;
    true satisfies AssertSame<Merge<number, string>, string & number>;
    true satisfies AssertSame<Merge<unknown, string>, string>;
    true satisfies AssertSame<Merge<string, unknown>, string>;
    true satisfies AssertSame<Merge<unknown, unknown>, unknown>;

    true satisfies AssertSame<OneOf<string, number>, number>;
    true satisfies AssertSame<OneOf<number, string>, string>;
    true satisfies AssertSame<OneOf<unknown, string>, string>;
    true satisfies AssertSame<OneOf<string, unknown>, string>;
    true satisfies AssertSame<OneOf<unknown, unknown>, unknown>;
}

export type OverrideObject<A, B> = Expand<Omit<A, keyof B> & B>;
export type MergeObject<A, B> = A & B

// Static tests of MergeObject and OverrideObject
namespace StaticTests {
    true satisfies AssertSame<
        OverrideObject<{ a: 1, b: 2, d: 3 }, { b: "abc", c: 3, d?: undefined }>,
        { a: 1, b: "abc", c: 3, d?: undefined }
    >;
}
