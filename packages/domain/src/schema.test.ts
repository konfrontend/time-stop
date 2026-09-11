import { describe, expect, it } from 'vitest';
import { timestampSchema } from './schema.js';

describe('timestampSchema', () => {
  it('accepts ISO 8601 UTC at millisecond precision', () => {
    expect(timestampSchema.parse('2026-09-11T14:37:16.979Z')).toBe('2026-09-11T14:37:16.979Z');
  });

  it('rejects anything that would break lexical ordering', () => {
    for (const value of [
      '2026-09-11T14:37:16Z',
      '2026-09-11T14:37:16.9791Z',
      '2026-09-11T16:37:16.979+02:00',
      '2026-09-11T14:37:16.979',
      1_757_601_436_979,
    ]) {
      expect(timestampSchema.safeParse(value).success).toBe(false);
    }
  });
});
