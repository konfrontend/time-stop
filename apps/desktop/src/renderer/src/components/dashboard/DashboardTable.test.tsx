// @vitest-environment jsdom
import { useState } from 'react';
import type { RowSelectionState } from '@tanstack/react-table';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardRow, Rounding } from '@time-stop/domain';
import { RecordActions } from '@/components/record/RecordActions';
import { harness, renderWith, type Harness } from '@/test/harness';
import { aDashboardRow as row, recentRows } from '@/test/fixtures';
import { slots } from '@/test/slot';
import { DashboardTable } from './DashboardTable';

const now = Date.parse('2026-09-15T20:00:00.000Z');
const today = new Date(2026, 8, 15).toISOString();

let h: Harness;

function Table(props: { rows: DashboardRow[]; rounding?: Rounding }) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  return (
    <RecordActions workspaceId={h.workspace.id} projects={[]} today={today}>
      <DashboardTable
        rows={props.rows}
        loaded
        today={today}
        now={now}
        billable={false}
        rounding={props.rounding ?? 'none'}
        onBillable={vi.fn()}
        onRounding={vi.fn()}
        rowSelection={rowSelection}
        onRowSelectionChange={(updater) =>
          setRowSelection((current) => (typeof updater === 'function' ? updater(current) : updater))
        }
      />
      <output data-testid="selected">{Object.keys(rowSelection).join(',')}</output>
    </RecordActions>
  );
}

beforeEach(() => {
  h = harness();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DashboardTable', () => {
  it("sums a day's rounded Durations on its header", () => {
    renderWith(
      <Table
        rows={[
          row('r1', {
            record: { start: '2026-09-15T01:00:00.000Z', stop: '2026-09-15T01:50:00.000Z' },
          }),
          row('r2', {
            record: { start: '2026-09-15T03:00:00.000Z', stop: '2026-09-15T03:50:00.000Z' },
          }),
        ]}
        rounding="15m"
      />,
    );
    const [day] = slots('day-group');
    expect(within(day!).getByText('1:30')).toBeTruthy();
  });

  it('groups Records by day and adds one to a day from its header', async () => {
    renderWith(
      <Table rows={[row('r1'), row('r2', { record: { start: '2026-09-14T01:00:00.000Z' } })]} />,
    );
    const [, second] = slots('day-group');
    expect(slots('day-group')).toHaveLength(2);
    fireEvent.click(within(second!).getByRole('button', { name: /^Add Record/ }));

    await waitFor(async () => {
      const [added] = await recentRows(h);
      expect(added && new Date(added.record.start).getDate()).toBe(14);
    });
  });

  it('leaves the Record editor closed on a click in its time cell', () => {
    renderWith(<Table rows={[row('r1')]} />);
    fireEvent.click(slots('record-time')[0]!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('selects stopped Records, never the Timer', () => {
    renderWith(
      <Table
        rows={[
          row('timer', { record: { start: '2026-09-15T09:00:00.000Z', stop: null } }),
          row('r1'),
        ]}
      />,
    );
    const [timer] = slots('record-row');
    expect(within(timer!).getByRole('checkbox').hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(screen.getByTestId('selected').textContent).toBe('r1');
  });

  it("selects a day's stopped Records from its header", () => {
    renderWith(
      <Table
        rows={[
          row('timer', { record: { start: '2026-09-15T09:00:00.000Z', stop: null } }),
          row('r1'),
          row('r2', { record: { start: '2026-09-14T01:00:00.000Z' } }),
        ]}
      />,
    );
    const [todays, yesterdays] = slots('day-group').map((day) =>
      within(day).getByRole('checkbox', { name: /^Select Records/ }),
    );
    fireEvent.click(todays!);
    expect(screen.getByTestId('selected').textContent).toBe('r1');

    fireEvent.click(yesterdays!);
    fireEvent.click(todays!);
    expect(screen.getByTestId('selected').textContent).toBe('r2');
  });
});
