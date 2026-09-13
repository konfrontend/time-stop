// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardRow, Project } from '@time-stop/domain';
import { DashboardFooter } from './DashboardFooter';

const now = Date.parse('2026-09-15T10:00:00.000Z');
const project: Project = {
  id: 'p1',
  workspaceId: 'w1',
  clientId: null,
  name: 'Acme API',
  rate: 100,
  limitMin: null,
  limitMax: null,
  limitPeriod: null,
  startDate: null,
  endDate: null,
  color: '#4f6bd9',
  archived: false,
  updatedAt: '2026-09-01T08:00:00.000Z',
};
const row = (id: string, minutes: number): DashboardRow => ({
  record: {
    id,
    workspaceId: 'w1',
    projectId: 'p1',
    actorId: 'a1',
    name: '',
    start: '2026-09-15T01:00:00.000Z',
    stop: new Date(Date.parse('2026-09-15T01:00:00.000Z') + minutes * 60_000).toISOString(),
    updatedAt: '2026-09-15T02:00:00.000Z',
  },
  project,
  client: null,
  currency: 'USD',
  limits: null,
});

const handlers = { onExport: vi.fn(), onMove: vi.fn(), onDelete: vi.fn() };
const totals = { hours: 3, billableHours: 2, amounts: [{ currency: 'USD', amount: 200 }] };

function open(selected: DashboardRow[], rounding: 'none' | '15m' = 'none') {
  render(
    <DashboardFooter
      totals={totals}
      count={3}
      now={now}
      rounding={rounding}
      selected={selected}
      projects={[project]}
      busy={false}
      {...handlers}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DashboardFooter', () => {
  it('shows the totals and exports on one click', () => {
    open([]);
    expect(screen.getByText('3 Records')).toBeTruthy();
    expect(screen.getByText('200.00 USD')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(handlers.onExport).toHaveBeenCalledTimes(1);
  });

  it('sums the selection with its Rounding and confirms a Delete', async () => {
    open([row('a', 50), row('b', 7)], '15m');
    expect(screen.getByText('2 selected')).toBeTruthy();
    expect(screen.getByText('0:45 · 75.00 USD')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(handlers.onDelete).toHaveBeenCalledTimes(1);
  });

  it('moves the selection to a picked Project', async () => {
    open([row('a', 50)]);
    fireEvent.click(screen.getByRole('button', { name: 'Move to…' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Acme API' }));
    expect(handlers.onMove).toHaveBeenCalledWith('p1');
  });
});
