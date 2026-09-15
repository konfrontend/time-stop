import { createRootRoute, createRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { dashboardSearchSchema } from './lib/dashboardSearch';
import { Layout } from './routes/Layout';
import { Tracker } from './routes/Tracker';
import { Dashboard } from './routes/Dashboard';
import { Settings } from './routes/Settings';
import { GeneralTab } from './components/settings/GeneralTab';
import { WorkspacesTab } from './components/settings/WorkspacesTab';

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

export const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  validateSearch: (search) => dashboardSearchSchema.parse(search),
  component: Dashboard,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Settings,
});

// The tab is in the URL, so a plain /settings lands on Workspaces, at the top.
const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/settings/workspaces' });
  },
});

// "Manage Workspaces…" passes the Context's Workspace to scroll to.
export const settingsWorkspacesRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/workspaces',
  validateSearch: (search) => z.object({ workspace: z.string().optional() }).parse(search),
  component: function SettingsWorkspaces() {
    return <WorkspacesTab focus={settingsWorkspacesRoute.useSearch().workspace} />;
  },
});

export const settingsGeneralRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/general',
  component: GeneralTab,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  trackerRoute,
  dashboardRoute,
  settingsRoute.addChildren([settingsIndexRoute, settingsWorkspacesRoute, settingsGeneralRoute]),
]);
