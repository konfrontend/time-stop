import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { event, method, type } from './contract.js';

describe('method', () => {
  it('keeps the input schema as its only runtime value', () => {
    const input = z.object({ id: z.string() });
    expect(method({ input, output: type<string>() })).toEqual({ kind: 'method', input });
  });

  it('holds no input when the method takes no argument', () => {
    expect(method({ output: type<void>() })).toEqual({ kind: 'method', input: undefined });
  });
});

describe('event', () => {
  it('is a bare marker', () => {
    expect(event<number>()).toEqual({ kind: 'event' });
  });
});
