import { AssertSame } from "./is_same_type";
import { IfUndefined } from "./is_undefined";

export type OmitUndefined<T> = {
    [Key in keyof T as IfUndefined<T[Key], never, Key>]: T[Key]
}

// Static tests for OmitUndefined
namespace StaticTests {
    true satisfies AssertSame<
        OmitUndefined<{ a: 1, b: undefined, c?: 1, d?: undefined, e: unknown }>,
        { a: 1, c?: 1, e: unknown }
    >;
}

type TestMe<A extends {a?: any, b?: any, c?: any}> = OmitUndefined<A>;
