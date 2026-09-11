import { describe, expect, it } from 'vitest';
import { workspaceInputSchema } from './inputs.js';

describe('workspaceInputSchema', () => {
  it('trims the Currency and treats an empty one as absent', () => {
    expect(workspaceInputSchema.parse({ name: ' Work ', currency: ' USDT ' })).toEqual({
      name: 'Work',
      currency: 'USDT',
    });
    expect(workspaceInputSchema.parse({ name: 'Work', currency: '  ' }).currency).toBeNull();
    expect(workspaceInputSchema.parse({ name: 'Work', currency: null }).currency).toBeNull();
  });
});
