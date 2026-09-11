import type { z, ZodType } from 'zod';

export declare const phantom: unique symbol;

/** Carries `T` to inference only; there is no runtime value behind it. */
export interface Type<T> {
  readonly [phantom]: T;
}

export function type<T>(): Type<T> {
  return undefined as unknown as Type<T>;
}

export interface MethodDescriptor<
  Input extends ZodType | undefined = ZodType | undefined,
  Output = unknown,
> {
  readonly kind: 'method';
  readonly input: Input;
  readonly [phantom]?: Output;
}

export interface EventDescriptor<Value = unknown> {
  readonly kind: 'event';
  readonly [phantom]?: Value;
}

/** Groups of descriptors, walked by transports to derive channels, handlers and bridges. */
export type Contract = {
  readonly [group: string]: { readonly [member: string]: MethodDescriptor | EventDescriptor };
};

export function method<Output>(spec: { output: Type<Output> }): MethodDescriptor<undefined, Output>;
export function method<Input extends ZodType, Output>(spec: {
  input: Input;
  output: Type<Output>;
}): MethodDescriptor<Input, Output>;
export function method(spec: { input?: ZodType; output: Type<unknown> }): MethodDescriptor {
  return { kind: 'method', input: spec.input };
}

export function event<Value>(): EventDescriptor<Value> {
  return { kind: 'event' };
}

type MemberOf<Descriptor> =
  Descriptor extends MethodDescriptor<infer Input, infer Output>
    ? Input extends ZodType
      ? undefined extends z.infer<Input>
        ? (input?: z.infer<Input>) => Promise<Output>
        : (input: z.infer<Input>) => Promise<Output>
      : () => Promise<Output>
    : Descriptor extends EventDescriptor<infer Value>
      ? (listener: (value: Value) => void) => () => void
      : never;

export type ApiOf<Groups> = {
  [Group in keyof Groups]: { [Member in keyof Groups[Group]]: MemberOf<Groups[Group][Member]> };
};
