export type Expand<T> = T extends unknown ? { [K in keyof T]: T[K] } : never;
