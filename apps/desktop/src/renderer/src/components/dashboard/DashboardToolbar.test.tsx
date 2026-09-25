// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseIsoDate, periodBounds } from '@app/domain';
import type { Project } from '@app/domain';
import type { DashboardSelection } from '@/lib/dashboardSearch';
import { harness, renderWith } from '@/test/harness';
import { seedProject } from '@/test/fixtures';
import { slots } from '@/test/slot';
import { DashboardToolbar } from './DashboardToolbar';

let project: Project;

const selection: DashboardSelection = {
  period: 'month',
  anchor: '2026-09-01',
  from: '2026-09-01T00:00:00.000Z',
  to: '2026-09-30T23:59:59.999Z',
  workspace: 'w1',
  project: null,
  billable: false,
  rounding: 'none',
};

const handlers = {
  onProject: vi.fn(),
  onPeriod: vi.fn(),
  onAnchor: vi.fn(),
  onExport: vi.fn(),
};

function open(overrides: Partial<DashboardSelection> = {}, busy = false) {
  renderWith(
    <DashboardToolbar
      selection={{ ...selection, ...overrides }}
      projects={[project]}
      busy={busy}
      {...handlers}
    />,
  );
}

beforeEach(async () => {
  project = await seedProject(harness(), { name: 'Acme API', rate: 100 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DashboardToolbar', () => {
  it('clears the Project filter from the list', async () => {
    open({ project: project.id });
    fireEvent.click(screen.getByRole('combobox', { name: 'Project' }));
    fireEvent.click(await screen.findByRole('option', { name: 'All Projects' }));
    expect(handlers.onProject).toHaveBeenCalledWith(null);
  });

  it('offers no Project to create from the filter', async () => {
    open();
    fireEvent.click(screen.getByRole('combobox', { name: 'Project' }));
    const list = await screen.findByRole('dialog');
    fireEvent.change(within(list).getByRole('combobox'), { target: { value: 'Nothing' } });
    expect(within(list).queryByRole('option')).toBeNull();
    expect(within(list).queryByRole('button', { name: /Create/ })).toBeNull();
  });

  it('exports the view, and not while a mutation is in flight', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(handlers.onExport).toHaveBeenCalledTimes(1);
    cleanup();
    open({}, true);
    expect(screen.getByRole('button', { name: 'Export' }).hasAttribute('disabled')).toBe(true);
  });

  it('switches the Period from inside the Range popover', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /September/ }));
    const popover = await screen.findByRole('dialog');
    const period = within(popover).getByRole('radiogroup', { name: 'Period' });
    fireEvent.click(within(period).getByRole('radio', { name: 'Week' }));
    expect(handlers.onPeriod).toHaveBeenCalledWith('week');
  });

  it('picks the week Range in the grid, whatever day the anchor is', async () => {
    const anchor = '2026-05-01';
    open({ period: 'week', anchor, ...periodBounds('week', parseIsoDate(anchor)) });
    fireEvent.click(slots('range-label')[0]!);
    const grid = await screen.findByRole('grid', { name: 'April 2026' });
    const picked = within(grid).getAllByRole('gridcell', { selected: true });
    expect(picked.map((day) => day.getAttribute('data-day'))).toEqual([
      '2026-04-27',
      '2026-04-28',
      '2026-04-29',
      '2026-04-30',
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
    ]);
  });
});
