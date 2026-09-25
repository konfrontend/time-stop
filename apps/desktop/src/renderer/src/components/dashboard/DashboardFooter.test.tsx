// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardRow, Project, Totals } from '@app/domain';
import { slot } from '@/test/slot';
import { DashboardFooter } from './DashboardFooter';

const HOUR = 3_600_000;
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

const handlers = { onMove: vi.fn(), onDelete: vi.fn() };
const totals: Totals = {
  ms: 0.75 * HOUR,
  billableMs: 0.75 * HOUR,
  amounts: [{ currency: 'USD', amount: 75 }],
};

function open(selected: DashboardRow[]) {
  render(
    <DashboardFooter
      totals={totals}
      count={3}
      selected={selected}
      workspaceId="w1"
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
  it('shows the selection’s Totals and confirms a Delete', async () => {
    open([row('a', 50), row('b', 7)]);
    expect(screen.getByText('0:45')).toBeTruthy();
    expect(screen.getByText('75.00 USD')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click((await slot('delete-confirm')).getByRole('button', { name: 'Delete' }));
    expect(handlers.onDelete).toHaveBeenCalledTimes(1);
  });

  it('moves the selection to a picked Project', async () => {
    open([row('a', 50)]);
    fireEvent.click(screen.getByRole('button', { name: 'Move to…' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Acme API' }));
    expect(handlers.onMove).toHaveBeenCalledWith('p1');
  });
});
