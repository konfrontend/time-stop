import { describe, expect, it } from 'vitest';
import { workspaceInputSchema } from './inputs.js';

const workspace = { name: 'Work', currency: null, color: '#4f6bd9' };

describe('workspaceInputSchema', () => {
  it('trims the Currency and treats an empty one as absent', () => {
    expect(
      workspaceInputSchema.parse({ ...workspace, name: ' Work ', currency: ' USDT ' }),
    ).toEqual({ name: 'Work', currency: 'USDT', color: '#4f6bd9' });
    expect(workspaceInputSchema.parse({ ...workspace, currency: '  ' }).currency).toBeNull();
    expect(workspaceInputSchema.parse({ ...workspace, currency: null }).currency).toBeNull();
  });

  it('accepts only hex colors', () => {
    expect(workspaceInputSchema.safeParse({ ...workspace, color: 'red' }).success).toBe(false);
  });
});
