import { AssertSame } from "./is_same_type";

export type IfMember<T, M, Y, N> = M extends keyof T ? Y : N;
export type IsMember<T, M> = IfMember<T, M, true, never>;

namespace StaticTests {
    true satisfies AssertSame<IfMember<{ a: string }, "a", true, never>, true>;
    true satisfies AssertSame<IfMember<{ a: string }, "b", never, false>, false>;
    true satisfies AssertSame<IfMember<{ a?: string }, "a", true, never>, true>;
    true satisfies AssertSame<IfMember<{ a?: string }, "b", never, false>, false>;
}

export type IfRequiredMember<T, M, Y, N> = M extends keyof T ? T extends Required<Pick<T, M>> ? Y : N : N;
export type IsRequiredMember<T, M> = IfRequiredMember<T, M, true, never>;

namespace StaticTests {
    true satisfies AssertSame<IfRequiredMember<{ a: string }, "a", true, never>, true>;
    true satisfies AssertSame<IfRequiredMember<{ a: string }, "b", never, false>, false>;
    true satisfies AssertSame<IfRequiredMember<{ a?: string }, "a", never, false>, false>;
    true satisfies AssertSame<IfRequiredMember<{ a?: string }, "b", never, false>, false>;
}
