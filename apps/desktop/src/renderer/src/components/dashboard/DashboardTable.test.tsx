// @vitest-environment jsdom
import { useState } from 'react';
import type { RowSelectionState } from '@tanstack/react-table';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardRow, Rounding } from '@time-stop/domain';
import { harness, renderWith } from '@/test/harness';
import { aDashboardRow as row, aProject } from '@/test/fixtures';
import { slot, slots } from '@/test/slot';
import { DashboardTable } from './DashboardTable';

const now = Date.parse('2026-09-15T20:00:00.000Z');
const today = new Date(2026, 8, 15).toISOString();

const project = aProject({ name: 'Acme API' });

function Table(props: { rows: DashboardRow[]; rounding?: Rounding; editing?: string }) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [editing, setEditing] = useState<string | null>(props.editing ?? null);
  const projects = [project, ...props.rows.flatMap((each) => (each.project ? [each.project] : []))];
  return (
    <>
      <DashboardTable
        rows={props.rows}
        loaded
        today={today}
        now={now}
        billable={false}
        rounding={props.rounding ?? 'none'}
        onBillable={vi.fn()}
        onRounding={vi.fn()}
        workspaceId={props.rows[0]?.record.workspaceId ?? project.workspaceId}
        projects={projects}
        editing={editing}
        onEditing={setEditing}
        onAdd={handlers.onAdd}
        rowSelection={rowSelection}
        onRowSelectionChange={(updater) =>
          setRowSelection((current) => (typeof updater === 'function' ? updater(current) : updater))
        }
        onRename={handlers.onRename}
        onDelete={handlers.onDelete}
      />
      <output data-testid="selected">{Object.keys(rowSelection).join(',')}</output>
    </>
  );
}

const handlers = { onAdd: vi.fn(), onRename: vi.fn(), onDelete: vi.fn() };

beforeEach(() => {
  harness();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const onlyRow = () => within(slots('record-row')[0]!);

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

  it('groups Records by day and adds one to a day from its header', () => {
    renderWith(
      <Table rows={[row('r1'), row('r2', { record: { start: '2026-09-14T01:00:00.000Z' } })]} />,
    );
    const [first, second] = slots('day-group');
    expect(slots('day-group')).toHaveLength(2);
    fireEvent.click(within(second!).getByRole('button', { name: /^Add Record/ }));
    expect(handlers.onAdd).toHaveBeenCalledWith(new Date(2026, 8, 14).toISOString());
    expect(first).toBeTruthy();
  });

  it('renames a Record in its row', () => {
    renderWith(<Table rows={[row('r1')]} />);
    const name = onlyRow().getByRole('textbox');
    fireEvent.change(name, { target: { value: 'Review' } });
    fireEvent.blur(name);
    expect(handlers.onRename).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }), 'Review');
  });

  it('leaves the Record editor closed on a click in its time cell', () => {
    renderWith(<Table rows={[row('r1')]} />);
    fireEvent.click(slots('record-time')[0]!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('edits the Record in a Popover from its context menu', async () => {
    renderWith(<Table rows={[row('r1')]} />);
    fireEvent.contextMenu(slots('record-row')[0]!);
    fireEvent.click(await screen.findByRole('menuitem', { name: /Edit/ }));
    const popover = await slot('record-popover');
    expect(popover.getByLabelText('Name')).toHaveProperty('value', 'Redesign');
  });

  it('deletes one Record from its context menu once confirmed', async () => {
    renderWith(<Table rows={[row('r1')]} />);
    fireEvent.contextMenu(slots('record-row')[0]!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(handlers.onDelete).not.toHaveBeenCalled();
    const confirm = await slot('delete-confirm');
    fireEvent.click(confirm.getByRole('button', { name: 'Delete' }));
    expect(handlers.onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
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
