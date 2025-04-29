/**
 * Detects whether the compiler is currently running in strict mode.
 */
export type IfCompiledInStrictMode<Y, N> = unknown extends {} ? N : Y;

/**
 * Detects whether the compiler is currently running in strict mode.
 */
export type IsCompiledInStrictMode = IfCompiledInStrictMode<true, false>;
