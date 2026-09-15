// @vitest-environment jsdom
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RowSelectionState } from '@tanstack/react-table';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardRow, Project, Rounding } from '@time-stop/domain';
import { TooltipProvider } from '@/components/ui/tooltip';
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

function Harness(props: { rows: DashboardRow[]; rounding?: Rounding; editing?: string }) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [editing, setEditing] = useState<string | null>(props.editing ?? null);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DashboardTable
          rows={props.rows}
          loaded
          today={today}
          now={now}
          rounding={props.rounding ?? 'none'}
          workspaceId="w1"
          projects={[project]}
          editing={editing}
          onEditing={setEditing}
          onAdd={handlers.onAdd}
          rowSelection={rowSelection}
          onRowSelectionChange={(updater) =>
            setRowSelection((current) =>
              typeof updater === 'function' ? updater(current) : updater,
            )
          }
          onRename={handlers.onRename}
          onDelete={handlers.onDelete}
        />
        <output data-testid="selected">{Object.keys(rowSelection).join(',')}</output>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

const handlers = { onAdd: vi.fn(), onRename: vi.fn(), onDelete: vi.fn() };
const queryClient = new QueryClient();

beforeEach(() => {
  Object.assign(window, { timeStop: { record: { recentNames: vi.fn(async () => []) } } });
});

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

  it('groups by day and adds a Record to a day from its header', () => {
    const rows = [row('r1'), row('r2', { record: { start: '2026-09-14T01:00:00.000Z' } })];
    render(<Harness rows={rows} />);
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Yesterday')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add Record on Yesterday' }));
    expect(handlers.onAdd).toHaveBeenCalledWith(new Date(2026, 8, 14).toISOString());
  });

  it("keeps a day's add button shown while the Name of the Record it added is open", () => {
    const rows = [row('r1'), row('r2', { record: { start: '2026-09-14T01:00:00.000Z' } })];
    render(<Harness rows={rows} editing="r2" />);
    const add = (day: string) => screen.getByRole('button', { name: `Add Record on ${day}` });
    expect(add('Yesterday').dataset.adding).toBe('true');
    expect(add('Today').dataset.adding).toBeUndefined();

    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape' });
    expect(add('Yesterday').dataset.adding).toBeUndefined();
  });

  it('opens the Name of the Record asked for and shows nothing for no Project', () => {
    render(<Harness rows={[row('r1', { project: null })]} editing="r1" />);
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.queryByText('No Project')).toBeNull();
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
    // The blur the unmount fires must not save either.
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(handlers.onRename).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Edit Name' }).textContent).toBe('Redesign');
  });

  it('shows "Untitled record" for a Record without a Name, at rest and while editing', () => {
    render(<Harness rows={[row('r1', { record: { name: '' } })]} />);
    expect(screen.getByRole('button', { name: 'Edit Name' }).textContent).toBe('Untitled record');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Name' }));
    expect(screen.getByLabelText('Name')).toHaveProperty('placeholder', 'Untitled record');
  });

  it('leaves the Record editor closed on a click in its time cell', () => {
    const { container } = render(<Harness rows={[row('r1')]} />);
    fireEvent.click(container.querySelector('[data-slot=record-time]')!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('edits the Record in a Popover from its context menu', async () => {
    render(<Harness rows={[row('r1')]} />);
    fireEvent.contextMenu(screen.getByText('Redesign'));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Edit/ }));
    const popover = await screen.findByRole('dialog');
    expect(popover.getAttribute('data-slot')).toBe('record-popover');
    expect(within(popover).getByLabelText('Name')).toHaveProperty('value', 'Redesign');
  });

  it('deletes one Record from its context menu after confirming', async () => {
    render(<Harness rows={[row('r1')]} />);
    fireEvent.contextMenu(screen.getByText('Redesign'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }),
    );
    expect(handlers.onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
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
