import type { AssertSame } from "./is_same_type";

export type If<T extends boolean, Y, N> = T extends true ? Y : T extends false ? N : Y | N;

namespace StaticTests {
    1 satisfies If<true, 1, 2>;
    1 satisfies If<boolean, 1, 2>;

    2 satisfies If<false, 1, 2>;
    2 satisfies If<boolean, 1, 2>;

    true satisfies AssertSame<If<true, 1, 2>, 1>;
    true satisfies AssertSame<If<false, 1, 2>, 2>

    false satisfies AssertSame<If<true, 1, 2>, 2>;
    false satisfies AssertSame<If<false, 1, 2>, 1>;
}

export type Not<T extends boolean> = If<T, false, true>;

namespace StaticTests {
    true satisfies Not<false>;
    false satisfies Not<true>;

    true satisfies Not<boolean>;
    false satisfies Not<boolean>;
}

export type And<A extends boolean, B extends boolean> = If<A, If<B, true, false>, false>;

namespace StaticTests {
    true satisfies And<true, true>;
    false satisfies And<true, false>;
    false satisfies And<false, true>;
    false satisfies And<false, false>;
}

export type Or<A extends boolean, B extends boolean> = If<A, true, If<B, true, false>>;

namespace StaticTests {
    true satisfies Or<true, true>;
    true satisfies Or<true, false>;
    true satisfies Or<false, true>;
    false satisfies Or<false, false>;
}

export type Xor<A extends boolean, B extends boolean> = If<A, If<B, false, true>, If<B, true, false>>;

namespace StaticTests {
    false satisfies Xor<true, true>;
    true satisfies Xor<true, false>;
    true satisfies Xor<false, true>;
    false satisfies Xor<false, false>;
}
