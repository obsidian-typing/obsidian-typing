import type { If, Not } from "./conditionals";
import type { IsAny } from "./is_any";
import type { AssertSame } from "./is_same_type";
import type { IsCompiledInStrictMode } from "./is_strict_mode";

export type IfUnknown<T, Y, N> = IsAny<T> extends never ? unknown extends T ? keyof T extends never ? Y : N : N : N;
export type IsUnknown<T> = IfUnknown<T, true, never>;

// Static tests for IfUnknown and IsUnknown
namespace StaticTests {
    true satisfies unknown extends unknown ? true : false;
    true satisfies AssertSame<unknown extends Partial<{ item: string }> ? true : false, Not<IsCompiledInStrictMode>>

    true satisfies keyof unknown extends never ? true : false;
    false satisfies keyof Partial<{ item: string }> extends never ? true : false;

    true satisfies AssertSame<IsUnknown<unknown>, true>;
    true satisfies AssertSame<IsUnknown<any>, never>;
    true satisfies AssertSame<IsUnknown<Partial<{ item: string }>>, never>;
    true satisfies AssertSame<IsUnknown<{}>, If<IsCompiledInStrictMode, never, true>>; // Edge case
}
