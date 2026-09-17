// @vitest-environment jsdom
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RowSelectionState } from '@tanstack/react-table';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

function Harness(props: {
  rows: DashboardRow[];
  billable?: boolean;
  rounding?: Rounding;
  editing?: string;
  now?: number;
}) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [editing, setEditing] = useState<string | null>(props.editing ?? null);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DashboardTable
          rows={props.rows}
          loaded
          today={today}
          now={props.now ?? now}
          billable={props.billable ?? false}
          rounding={props.rounding ?? 'none'}
          onBillable={handlers.onBillable}
          onRounding={handlers.onRounding}
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

const handlers = {
  onAdd: vi.fn(),
  onRename: vi.fn(),
  onDelete: vi.fn(),
  onBillable: vi.fn(),
  onRounding: vi.fn(),
};
const queryClient = new QueryClient();

const update = vi.fn(async (input: object) => input);

beforeEach(() => {
  Object.assign(window, {
    timeStop: { record: { recentNames: vi.fn(async () => []), update } },
  });
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

  it('marks a Billable Record with the gold bars, and no other', () => {
    render(
      <Harness
        rows={[
          row('r1'),
          row('r2', {
            project: { ...project, rate: null },
            record: { start: '2026-09-15T03:00:00.000Z' },
          }),
          row('r3', { currency: null, record: { start: '2026-09-15T05:00:00.000Z' } }),
          row('r4', { project: null, record: { start: '2026-09-15T07:00:00.000Z' } }),
        ]}
      />,
    );
    const billable = screen.getAllByRole('img', { name: 'Billable' });
    expect(billable).toHaveLength(1);
    expect(billable[0]!.closest('[data-slot="record-row"]')?.textContent).toContain('110.00 USD');
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

    // The Record it added holds focus; Escape gives its Name up and closes the row.
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    fireEvent.blur(document.activeElement!);
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
    const { container } = render(<Harness rows={[row('r1')]} />);
    const name = () => container.querySelector<HTMLInputElement>('[data-slot=record-name]')!;
    fireEvent.change(name(), { target: { value: 'Review ' } });
    fireEvent.keyDown(name(), { key: 'Enter' });
    fireEvent.blur(name());
    expect(handlers.onRename).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }), 'Review');

    fireEvent.change(name(), { target: { value: 'Dropped' } });
    fireEvent.keyDown(name(), { key: 'Escape' });
    // The blur that Escape fires must not save either.
    fireEvent.blur(name());
    expect(handlers.onRename).toHaveBeenCalledTimes(1);
    expect(name().value).toBe('Redesign');
  });

  it('shows "Untitled record" for a Record without a Name', () => {
    const { container } = render(<Harness rows={[row('r1', { record: { name: '' } })]} />);
    const name = container.querySelector<HTMLInputElement>('[data-slot=record-name]')!;
    expect(name.value).toBe('');
    expect(name.placeholder).toBe('Untitled record');
  });

  it('leaves the Record editor closed on a click in its time cell', () => {
    const { container } = render(<Harness rows={[row('r1')]} />);
    fireEvent.click(container.querySelector('[data-slot=record-time]')!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  describe('inline start and stop', () => {
    const local = (h: number, m = 0) => new Date(2026, 8, 15, h, m).toISOString();
    const stopped = () => row('r1', { record: { start: local(9), stop: local(11) } });
    const edit = (which: 'start' | 'stop') => {
      fireEvent.click(screen.getByRole('button', { name: `Edit ${which}` }));
      return screen.getByRole('combobox', { name: which === 'start' ? 'Start' : 'Stop' });
    };
    // Mutations reach the IPC bridge a tick later.
    const settle = () => act(() => new Promise((resolve) => setTimeout(resolve)));

    it('saves a start clicked in the list at once, with the other fields unchanged', async () => {
      render(<Harness rows={[stopped()]} />);
      const input = edit('start') as HTMLInputElement;
      expect(document.activeElement).toBe(input);
      expect([input.selectionStart, input.selectionEnd]).toEqual([0, input.value.length]);

      fireEvent.click(await screen.findByRole('option', { name: /^08:30( AM)?$/ }));
      await settle();
      expect(update).toHaveBeenCalledExactlyOnceWith({
        id: 'r1',
        projectId: 'p1',
        name: 'Redesign',
        start: local(8, 30),
        stop: local(11),
      });
      expect(screen.queryByRole('combobox')).toBeNull();
    });

    it('saves a typed stop on Enter and on blur', async () => {
      render(<Harness rows={[stopped()]} />);
      let input = edit('stop');
      fireEvent.change(input, { target: { value: '11:45' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await settle();
      expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ stop: local(11, 45) }));
      expect(screen.queryByRole('combobox')).toBeNull();

      input = edit('stop');
      fireEvent.change(input, { target: { value: '1215' } });
      fireEvent.blur(input);
      await settle();
      expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ stop: local(12, 15) }));
      await settle();
      expect(update).toHaveBeenCalledTimes(2);
    });

    it('does not save an unchanged time, nor one given up with Escape', async () => {
      render(<Harness rows={[stopped()]} />);
      fireEvent.keyDown(edit('start'), { key: 'Enter' });
      expect(screen.queryByRole('combobox')).toBeNull();

      const input = edit('stop');
      fireEvent.change(input, { target: { value: '11:45' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      // The blur the unmount fires must not save either.
      expect(screen.queryByRole('combobox')).toBeNull();
      await settle();
      expect(update).not.toHaveBeenCalled();
    });

    it('marks a stop before start and reverts it instead of saving', async () => {
      render(<Harness rows={[stopped()]} />);
      const input = edit('stop');
      fireEvent.change(input, { target: { value: '08:00' } });
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByRole('tooltip').textContent).toBe('Stop must not precede start');

      fireEvent.keyDown(input, { key: 'Enter' });
      await settle();
      expect(update).not.toHaveBeenCalled();
      expect(screen.queryByRole('combobox')).toBeNull();
      expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it("edits a running Timer's start but not its now, and rejects a start after now", async () => {
      render(
        <Harness
          rows={[row('timer', { record: { start: local(9), stop: null } })]}
          now={Date.parse(local(10))}
        />,
      );
      expect(screen.queryByRole('button', { name: 'Edit stop' })).toBeNull();
      expect(screen.getByText('now').closest('button')).toBeNull();

      const input = edit('start');
      fireEvent.change(input, { target: { value: '10:30' } });
      expect(screen.getByRole('tooltip').textContent).toBe('Start must not be after now');
      fireEvent.blur(input);
      await settle();
      expect(update).not.toHaveBeenCalled();

      fireEvent.change(edit('start'), { target: { value: '09:15' } });
      fireEvent.blur(screen.getByRole('combobox'));
      await settle();
      expect(update).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ start: local(9, 15), stop: null }),
      );
    });
  });

  it('edits the Record in a Popover from its context menu', async () => {
    const { container } = render(<Harness rows={[row('r1')]} />);
    fireEvent.contextMenu(container.querySelector('[data-slot=record-row]') ?? document.body);
    fireEvent.click(await screen.findByRole('menuitem', { name: /Edit/ }));
    const popover = await screen.findByRole('dialog');
    expect(popover.getAttribute('data-slot')).toBe('record-popover');
    expect(within(popover).getByLabelText('Name')).toHaveProperty('value', 'Redesign');
  });

  it('deletes one Record from its context menu after confirming', async () => {
    const { container } = render(<Harness rows={[row('r1')]} />);
    fireEvent.contextMenu(container.querySelector('[data-slot=record-row]') ?? document.body);
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

  it("selects a day's stopped Records from its header", () => {
    render(
      <Harness
        rows={[
          row('timer', { record: { start: '2026-09-15T09:00:00.000Z', stop: null } }),
          row('r1'),
          row('r2', { record: { start: '2026-09-14T01:00:00.000Z' } }),
        ]}
      />,
    );
    const today = screen.getByRole('checkbox', { name: 'Select Records on Today' });
    fireEvent.click(today);
    expect(screen.getByTestId('selected').textContent).toBe('r1');
    expect(today.getAttribute('data-state')).toBe('checked');
    const yesterday = screen.getByRole('checkbox', { name: 'Select Records on Yesterday' });
    expect(yesterday.getAttribute('data-state')).toBe('unchecked');

    fireEvent.click(yesterday);
    fireEvent.click(today);
    expect(screen.getByTestId('selected').textContent).toBe('r2');
  });

  it('toggles the Billable filter from the Record header', () => {
    render(<Harness rows={[row('r1')]} billable />);
    const toggle = screen.getByRole('button', { name: 'Billable only' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    expect(handlers.onBillable).toHaveBeenCalledWith(false);
  });

  it('picks the Rounding from the Time header', async () => {
    render(<Harness rows={[row('r1')]} rounding="15m" />);
    const picker = screen.getByRole('button', { name: 'Rounding' });
    expect(picker.getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(picker, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitemradio', { name: '30 min' }));
    expect(handlers.onRounding).toHaveBeenCalledWith('30m');
  });

  it('says when the Range is empty', () => {
    render(<Harness rows={[]} />);
    expect(screen.getByText('No Records in this Range')).toBeTruthy();
  });
});
