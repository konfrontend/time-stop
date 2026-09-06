import { describe, expect, it } from 'vitest';
import { can, permissions } from './permissions.js';

describe('can', () => {
  it('grants the Owner every permission', () => {
    for (const permission of permissions) expect(can('owner', permission)).toBe(true);
  });
});
