import { describe, expect, it } from 'vitest';
import { durationMs } from './time.js';

describe('durationMs', () => {
  it('is the span from start to stop in milliseconds', () => {
    const start = Date.UTC(2026, 0, 1, 9, 0, 0);
    const stop = Date.UTC(2026, 0, 1, 10, 30, 0);
    expect(durationMs(start, stop)).toBe(90 * 60 * 1000);
  });
});
