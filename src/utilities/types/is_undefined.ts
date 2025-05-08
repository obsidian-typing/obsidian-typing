import type { IfAny } from "./is_any";
import type { AssertSame, IfSameType } from "./is_same_type";

export type IfUndefined<T, Y, N> = IfSameType<T, undefined, IfAny<T, N, Y>, N>
export type IsUndefined<T> = IfUndefined<T, true, never>;

// Static tests for IfUnknown and IsUnknown
namespace StaticTests {
    // The condition should only match undefined by itself...
    true satisfies AssertSame<IsUndefined<undefined>, true>;
    true satisfies AssertSame<IsUndefined<undefined | undefined>, true>;
    true satisfies AssertSame<IsUndefined<undefined & undefined>, true>;

    // Edge case with unknown & undefined
    true satisfies AssertSame<IsUndefined<unknown & undefined>, true>;

    // Everything else should not be matched...
    true satisfies AssertSame<IsUndefined<null>, never>;
    true satisfies AssertSame<IsUndefined<any>, never>;
    true satisfies AssertSame<IsUndefined<unknown>, never>;
    true satisfies AssertSame<IsUndefined<string>, never>;
    true satisfies AssertSame<IsUndefined<number>, never>;
    true satisfies AssertSame<IsUndefined<{}>, never>;

    // ...including unions that contain undefined + other types
    true satisfies AssertSame<IsUndefined<null | undefined>, never>;
    true satisfies AssertSame<IsUndefined<string | undefined>, never>;
    true satisfies AssertSame<IsUndefined<any | undefined>, never>;

    // ...as well as intersection types that contain undefined
    true satisfies AssertSame<IsUndefined<null & undefined>, never>;
    true satisfies AssertSame<IsUndefined<any & undefined>, never>;
    true satisfies AssertSame<IsUndefined<string & undefined>, never>;
    true satisfies AssertSame<IsUndefined<number & undefined>, never>;
    true satisfies AssertSame<IsUndefined<{} & undefined>, never>;
    // true satisfies AssertSame<IsUndefined<unknown & undefined>, never>; // See edge case above
}
