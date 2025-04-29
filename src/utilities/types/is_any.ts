export type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N;
export type IsAny<T> = IfAny<T, true, never>;

// Static tests for IfAny and IsAny
namespace StaticTests {
    true satisfies IfAny<any, true, false>
    true satisfies IsAny<any> extends never ? false : true

    false satisfies IfAny<unknown, true, false>;
    true satisfies IsAny<unknown> extends never ? true : false;
}
