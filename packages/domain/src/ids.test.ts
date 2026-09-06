import { describe, expect, it } from 'vitest';
import { uuidv7 } from './ids.js';

describe('uuidv7', () => {
  it('is a version 7, RFC variant UUID', () => {
    expect(uuidv7()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('embeds the millisecond it was minted at', () => {
    const at = Date.UTC(2026, 8, 6, 12, 0, 0);
    const id = uuidv7(at);
    expect(Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16)).toBe(at);
  });

  it('sorts by minting time', () => {
    const earlier = uuidv7(1000);
    const later = uuidv7(2000);
    expect(earlier < later).toBe(true);
    expect(uuidv7(1000)).not.toBe(earlier);
  });
});
