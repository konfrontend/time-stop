import { createHashHistory, createRouter } from '@tanstack/react-router';
import { routeTree } from './routes';

// Hash history keeps routing working when the packaged app loads index.html from disk.
export const router = createRouter({ routeTree, history: createHashHistory() });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
