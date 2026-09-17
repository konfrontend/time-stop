import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { routeTree } from './routes';

const router = () => createRouter({ routeTree, history: createMemoryHistory() });

describe('renderer routes', () => {
  it('has the three tab routes', () => {
    expect(Object.keys(router().routesByPath)).toEqual(
      expect.arrayContaining(['/tracker', '/dashboard', '/settings']),
    );
  });

  it('opens Settings on General', () => {
    const index = router().routesById['/settings/'] as unknown as {
      options: { beforeLoad: () => void };
    };

    expect(index.options.beforeLoad).toThrow(
      expect.objectContaining({ options: expect.objectContaining({ to: '/settings/general' }) }),
    );
  });
});
