import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { routeTree } from './routes';

describe('renderer routes', () => {
  it('has the three tab routes', () => {
    const router = createRouter({ routeTree, history: createMemoryHistory() });
    expect(Object.keys(router.routesByPath)).toEqual(
      expect.arrayContaining(['/tracker', '/dashboard', '/settings']),
    );
  });
});
