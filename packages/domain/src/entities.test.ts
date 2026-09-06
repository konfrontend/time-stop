import { describe, expect, it } from 'vitest';
import { v7 as uuid } from 'uuid';
import { idSchema } from './entities.js';

describe('idSchema', () => {
  it('accepts UUIDv7 and rejects other versions', () => {
    expect(idSchema.safeParse(uuid()).success).toBe(true);
    expect(idSchema.safeParse(crypto.randomUUID()).success).toBe(false);
  });
});
