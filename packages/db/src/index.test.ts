import { describe, expect, it } from 'vitest';
import { DIALECTS } from './index.js';

describe('db package', () => {
  it('uses sqlite on the desktop and postgres on the server', () => {
    expect(DIALECTS).toEqual({ desktop: 'sqlite', server: 'postgres' });
  });
});
