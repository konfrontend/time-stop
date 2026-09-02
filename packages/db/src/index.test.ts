import { describe, expect, it } from 'vitest';
import { DIALECTS } from './index.js';

describe('db package', () => {
  it('targets sqlite on the client and postgres on the server', () => {
    expect(DIALECTS).toEqual({ client: 'sqlite', server: 'postgres' });
  });
});
