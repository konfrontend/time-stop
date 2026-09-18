// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harness, renderWith, type Harness } from '@/test/harness';
import { nameWorkspace, seedProject, seedRecord } from '@/test/fixtures';
import { slot } from '@/test/slot';
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
  it('shows the Records of the Range', async () => {
    const project = await seedProject(h, { name: 'Acme API' });
    await seedRecord(h, {
      project,
      name: 'Redesign',
      start: '2026-09-15T09:00:00.000Z',
      stop: '2026-09-15T11:00:00.000Z',
    });
    renderWith(<Dashboard />);

    expect(await screen.findByDisplayValue('Redesign')).toBeTruthy();
  });

  it('totals the Range in the footer, then the selection once rows are ticked', async () => {
    const project = await seedProject(h, { rate: 100 });
    await seedRecord(h, {
      project,
      start: '2026-09-15T09:00:00.000Z',
      stop: '2026-09-15T11:00:00.000Z',
    });
    await seedRecord(h, {
      project,
      start: '2026-09-14T09:00:00.000Z',
      stop: '2026-09-14T10:00:00.000Z',
    });
    renderWith(<Dashboard />);

    const bar = await slot('totals-bar');
    await waitFor(() => expect(bar.getAllByText('3.00 h')).toHaveLength(2));
    expect(bar.getByText('300.00 USD')).toBeTruthy();

    const [today] = await slot('day-group').then((day) =>
      day.getAllByRole('checkbox', { name: /^Select Records/ }),
    );
    fireEvent.click(today!);
    const selection = await slot('totals-bar');
    expect(selection.getByText('1 selected')).toBeTruthy();
    expect(selection.getByText('2:00')).toBeTruthy();
    expect(selection.getByText('200.00 USD')).toBeTruthy();
  });

  it('writes the Rounding and Billable picks to the URL', async () => {
    await seedRecord(h);
    renderWith(<Dashboard />);
    const table = await slot('dashboard-table');
    const search = () => {
      const call = navigate.mock.calls.at(-1)?.[0] as { search: (prev: object) => object };
      return call.search({});
    };

    fireEvent.keyDown(table.getByRole('button', { name: 'Rounding' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitemradio', { name: '15 min' }));
    expect(search()).toEqual({ rounding: '15m' });

    fireEvent.click(table.getByRole('button', { name: 'Billable only' }));
    expect(search()).toEqual({ billable: true });
  });
});
