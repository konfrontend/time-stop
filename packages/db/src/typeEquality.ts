/**
 * Strict type equality for the schema parity assertions: `Equal` is false when one side is merely
 * assignable to the other (a wider column type, an optional key), which is the drift to catch.
 */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

export type Expect<T extends true> = T;
