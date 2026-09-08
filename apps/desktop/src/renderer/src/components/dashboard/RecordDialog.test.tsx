// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project, Record, Workspace } from '@time-stop/domain';
import { RecordDialog } from './RecordDialog';

const at = (day: number, h: number, m = 0) => new Date(2026, 8, day, h, m).getTime();
const today = at(15, 0);

const work: Workspace = { id: 'w1', name: 'Work', currency: 'USD', createdAt: 0, updatedAt: 0 };
const acme: Project = {
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
  updatedAt: 0,
};
const record: Record = {
  id: 'r1',
  workspaceId: 'w1',
  projectId: 'p1',
  actorId: 'a1',
  name: 'Redesign',
  start: at(15, 9),
  stop: at(15, 10),
  rate: 110,
  billable: true,
  updatedAt: 0,
};

const timeStop = {
  listWorkspaces: vi.fn(async () => [work]),
  listProjects: vi.fn(async () => [acme]),
  listRecentNames: vi.fn(async () => ['Review', 'Redesign']),
  createRecord: vi.fn(async (input: object) => ({ ...record, ...input })),
  updateRecord: vi.fn(async (input: object) => ({ ...record, ...input })),
  deleteRecord: vi.fn(async () => undefined),
};

function open(props: { record?: Record; projectId?: string | null } = {}) {
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RecordDialog
        record={props.record}
        context={{ workspaceId: 'w1', projectId: props.projectId ?? 'p1' }}
        today={today}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return onClose;
}

const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: /add record|save/i }));

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(window, { timeStop });
});
afterEach(cleanup);

describe('RecordDialog', () => {
  it('adds a stopped Record on the day with the Context Project', async () => {
    const onClose = open();
    type(/start/i, '09:00');
    type(/stop/i, '10:30');
    type(/name/i, 'Review');
    await act(async () => submit());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(timeStop.createRecord).toHaveBeenCalledWith({
      projectId: 'p1',
      name: 'Review',
      start: at(15, 9),
      stop: at(15, 10, 30),
      billable: false,
    });
  });

  it('rejects a stop before start on the stop field', async () => {
    const onClose = open();
    type(/start/i, '10:00');
    type(/stop/i, '09:00');
    await act(async () => submit());

    expect(await screen.findByText('Stop must not precede start')).toBeTruthy();
    expect(screen.getByLabelText(/stop/i).getAttribute('aria-invalid')).toBe('true');
    expect(timeStop.createRecord).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('warns once before saving a Record from a previous day, then proceeds', async () => {
    const yesterday = { ...record, start: at(14, 9), stop: at(14, 10) };
    const onClose = open({ record: yesterday });
    type(/name/i, 'Fixed');
    await act(async () => submit());

    expect(screen.getByRole('alert').textContent).toContain('previous day');
    expect(timeStop.updateRecord).not.toHaveBeenCalled();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save anyway' })));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(timeStop.updateRecord).toHaveBeenCalledWith({
      id: 'r1',
      projectId: 'p1',
      name: 'Fixed',
      start: at(14, 9),
      stop: at(14, 10),
      billable: true,
    });
  });

  it('saves a Record from today without a warning', async () => {
    const onClose = open({ record });
    type(/name/i, 'Same day');
    await act(async () => submit());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('suggests recent Names of the chosen Project', async () => {
    open();
    await waitFor(() => expect(timeStop.listRecentNames).toHaveBeenCalledWith({ projectId: 'p1' }));
    const list = document.getElementById(screen.getByLabelText(/name/i).getAttribute('list')!)!;
    await waitFor(() =>
      expect([...list.querySelectorAll('option')].map((o) => o.value)).toEqual([
        'Review',
        'Redesign',
      ]),
    );
    type(/project/i, '');
    await waitFor(() => expect(timeStop.listRecentNames).toHaveBeenCalledWith({ projectId: null }));
  });

  it('deletes after confirming, warning about a previous day', async () => {
    const yesterday = { ...record, start: at(14, 9), stop: at(14, 10) };
    const onClose = open({ record: yesterday });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete' })));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm.textContent).toContain('previous day');
    await act(async () =>
      fireEvent.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1)!),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(timeStop.deleteRecord).toHaveBeenCalledWith({ id: 'r1' });
  });
});
