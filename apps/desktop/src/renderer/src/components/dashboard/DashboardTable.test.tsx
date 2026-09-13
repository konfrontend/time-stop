// @vitest-environment jsdom
import { useState } from 'react';
import type { RowSelectionState } from '@tanstack/react-table';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardRow, Project, Rounding } from '@time-stop/domain';
import type { Sort } from '@/lib/dashboardSearch';
import { DashboardTable } from './DashboardTable';

const HOUR = 3_600_000;
const now = Date.parse('2026-09-15T10:00:00.000Z');
const today = new Date(2026, 8, 15).toISOString();

const project: Project = {
  id: 'p1',
  workspaceId: 'w1',
  clientId: null,
  name: 'Acme API',
  rate: 110,
  limitMin: null,
  limitMax: null,
  limitPeriod: null,
  startDate: null,
  endDate: null,
  color: '#4f6bd9',
  archived: false,
  updatedAt: '2026-09-01T08:00:00.000Z',
};

function row(
  id: string,
  overrides: Partial<Omit<DashboardRow, 'record'>> & {
    record?: Partial<DashboardRow['record']>;
  } = {},
): DashboardRow {
  return {
    project,
    client: null,
    currency: 'USD',
    limits: null,
    ...overrides,
    record: {
      id,
      workspaceId: 'w1',
      projectId: 'p1',
      actorId: 'a1',
      name: 'Redesign',
      start: '2026-09-15T01:00:00.000Z',
      stop: '2026-09-15T02:00:00.000Z',
      updatedAt: '2026-09-15T02:00:00.000Z',
      ...overrides.record,
    },
  };
}

const defaultSort: Sort = { sort: 'start', dir: 'desc' };

function Harness(props: { rows: DashboardRow[]; rounding?: Rounding; sort?: Sort }) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  return (
    <>
      <DashboardTable
        rows={props.rows}
        loaded
        today={today}
        now={now}
        rounding={props.rounding ?? 'none'}
        sort={props.sort ?? defaultSort}
        onSort={handlers.onSort}
        rowSelection={rowSelection}
        onRowSelectionChange={(updater) =>
          setRowSelection((current) => (typeof updater === 'function' ? updater(current) : updater))
        }
        onOpen={handlers.onOpen}
        onRename={handlers.onRename}
      />
      <output data-testid="selected">{Object.keys(rowSelection).join(',')}</output>
    </>
  );
}

const handlers = { onSort: vi.fn(), onOpen: vi.fn(), onRename: vi.fn() };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DashboardTable', () => {
  it('shows the Amount of a Record in a rated Project with a Currency, and none otherwise', () => {
    render(
      <Harness
        rows={[
          row('r1'),
          row('r2', {
            project: { ...project, rate: null },
            record: { start: '2026-09-15T03:00:00.000Z' },
          }),
        ]}
      />,
    );
    expect(screen.getAllByText('110.00 USD')).toHaveLength(1);
  });

  it('rounds the Duration and Amount on the row and the day header', () => {
    render(
      <Harness
        rows={[row('r1', { record: { stop: '2026-09-15T01:50:00.000Z' } })]}
        rounding="15m"
      />,
    );
    expect(screen.getAllByText('0:45')).toHaveLength(2);
    expect(screen.getByText('82.50 USD')).toBeTruthy();
    expect(screen.getByText('Today').parentElement?.textContent).toContain('0:45');
  });

  it('groups by day only when sorted by start', () => {
    const rows = [row('r1'), row('r2', { record: { start: '2026-09-14T01:00:00.000Z' } })];
    const { unmount } = render(<Harness rows={rows} />);
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Yesterday')).toBeTruthy();
    unmount();
    render(<Harness rows={rows} sort={{ sort: 'name', dir: 'asc' }} />);
    expect(screen.queryByText('Today')).toBeNull();
  });

  it('marks Limits usage outside Min and Max', () => {
    render(
      <Harness
        rows={[row('r1', { limits: { period: 'week', usedMs: 5 * HOUR, min: 2, max: 4 } })]}
      />,
    );
    const usage = screen.getByText('5/2–4h');
    expect(usage.dataset['outside']).toBe('true');
    expect(usage.title).toBe('5.0 of 2–4 h');
  });

  it('renames in place on Enter and gives up on Escape', () => {
    render(<Harness rows={[row('r1')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Name' }));
    const input = screen.getByLabelText('Name');
    fireEvent.change(input, { target: { value: 'Review ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(handlers.onRename).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }), 'Review');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Name' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dropped' } });
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape' });
    expect(handlers.onRename).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Edit Name' }).textContent).toBe('Redesign');
  });

  it('opens the Record from its time cell and sorts from the heads', () => {
    render(<Harness rows={[row('r1')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Record' }));
    expect(handlers.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Record' }));
    expect(handlers.onSort).toHaveBeenCalledWith({ sort: 'name', dir: 'asc' });
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    expect(handlers.onSort).toHaveBeenCalledWith({ sort: 'start', dir: 'asc' });
  });

  it('selects stopped Records, never the Timer', () => {
    render(
      <Harness
        rows={[
          row('timer', { record: { start: '2026-09-15T09:00:00.000Z', stop: null } }),
          row('r1'),
        ]}
      />,
    );
    const boxes = screen.getAllByRole('checkbox', { name: 'Select Record' });
    expect(boxes[0]?.hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(screen.getByTestId('selected').textContent).toBe('r1');
  });

  it('says when the Range is empty', () => {
    render(<Harness rows={[]} />);
    expect(screen.getByText('No Records in this Range')).toBeTruthy();
  });
});
