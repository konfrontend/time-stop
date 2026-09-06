import { createRootRoute, createRoute, redirect } from '@tanstack/react-router';
import { Layout } from './routes/Layout';
import { Tracker } from './routes/Tracker';
import { Dashboard } from './routes/Dashboard';
import { Settings } from './routes/Settings';

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
