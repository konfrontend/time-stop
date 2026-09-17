// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harness, renderWith, type Harness } from '@/test/harness';
import { nameWorkspace, seedProject, seedRecord } from '@/test/fixtures';
import { Dashboard } from './Dashboard';

const navigate = vi.fn();
const search = { anchor: '2026-09-15', period: 'month' as const };

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));
vi.mock('../routes', () => ({ dashboardRoute: { useSearch: () => search } }));

let h: Harness;

beforeEach(async () => {
  h = harness();
  await nameWorkspace(h, { name: 'Work' });
  await h.api.context.set({ workspaceId: h.workspace.id, projectId: null });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Dashboard', () => {
  it('shows the Records of the Range, priced by the Project Rate', async () => {
    const project = await seedProject(h, { name: 'Acme API', rate: 110 });
    await seedRecord(h, {
      project,
      name: 'Redesign',
      start: '2026-09-15T09:00:00.000Z',
      stop: '2026-09-15T11:00:00.000Z',
    });
    renderWith(<Dashboard />);

    expect(await screen.findByDisplayValue('Redesign')).toBeTruthy();
    // The Amount stands on the row and again in the day's total.
    await waitFor(() => expect(screen.getAllByText('220.00 USD').length).toBeGreaterThan(1));
  });

  it('leaves out what falls outside the Range', async () => {
    const project = await seedProject(h, { name: 'Acme API' });
    await seedRecord(h, { project, name: 'Last month', start: '2026-08-15T09:00:00.000Z' });
    await seedRecord(h, { project, name: 'This month', start: '2026-09-15T09:00:00.000Z' });
    renderWith(<Dashboard />);

    expect(await screen.findByDisplayValue('This month')).toBeTruthy();
    expect(screen.queryByDisplayValue('Last month')).toBeNull();
  });

  it('offers every Project of the Workspace in the filter', async () => {
    await seedProject(h, { name: 'Acme API' });
    await seedProject(h, { name: 'Globex' });
    renderWith(<Dashboard />);

    const filter = await screen.findByRole('combobox', { name: 'Project' });
    expect(within(filter).queryByText('All Projects')).toBeTruthy();
  });
});
