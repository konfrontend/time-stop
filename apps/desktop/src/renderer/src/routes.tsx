import { createRootRoute, createRoute, redirect } from '@tanstack/react-router';
import { Layout } from './routes/layout';
import { Tracker } from './routes/tracker';
import { Dashboard } from './routes/dashboard';
import { Settings } from './routes/settings';

const rootRoute = createRootRoute({ component: Layout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/tracker' });
  },
});

const trackerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tracker',
  component: Tracker,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: Dashboard,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Settings,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  trackerRoute,
  dashboardRoute,
  settingsRoute,
]);
