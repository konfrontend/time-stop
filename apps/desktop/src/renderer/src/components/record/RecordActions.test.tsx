// @vitest-environment jsdom
import { useEffect } from 'react';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardRow, Project, Record, UpdateRecordInput } from '@time-stop/domain';
import { useContextQuery } from '@/hooks/useContext';
import { harness, renderWith, type Harness } from '@/test/harness';
import { recentRows, seedProject, seedRecord } from '@/test/fixtures';
import { slot, slots } from '@/test/slot';
import {
  RecordActions,
  RecordFailure,
  RecordMenu,
  useRecordActions,
  type RecordActionsValue,
} from './RecordActions';

const today = new Date(2026, 8, 15).toISOString();

let h: Harness;
let project: Project;
// What the module hands its consumers, as of the last render.
let actions: RecordActionsValue;
// A day's add reads the Context's Project, so it waits for the Context to load.
let contextLoaded = false;

function Consumer() {
  const value = useRecordActions();
  const loaded = useContextQuery().data !== undefined;
  useEffect(() => {
    actions = value;
    contextLoaded = loaded;
  });
  return null;
}

function mount(rows: DashboardRow[], onContinue?: (row: DashboardRow) => Promise<void>) {
  renderWith(
    <RecordActions
      workspaceId={h.workspace.id}
      projects={[project]}
      today={today}
      onContinue={onContinue}
    >
      <Consumer />
      {rows.map((row) => (
        <RecordMenu key={row.record.id} row={row}>
          <div data-slot="record-row">{row.record.name}</div>
        </RecordMenu>
      ))}
      <RecordFailure />
    </RecordActions>,
  );
}

async function menu(index = 0) {
  fireEvent.contextMenu(slots('record-row')[index]!);
  return screen.findByRole('menu');
}

const pick = async (name: RegExp | string) =>
  fireEvent.click(await screen.findByRole('menuitem', { name }));

const saved = async (id: string) =>
  (await recentRows(h)).find((row) => row.record.id === id)?.record;

const failure = async () => (await slot('record-failure')).getByText(/./).textContent;

beforeEach(async () => {
  contextLoaded = false;
  h = harness();
  project = await seedProject(h, { name: 'Acme API' });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('RecordActions', () => {
  it('saves an edit from the row menu', async () => {
    await seedRecord(h, { project, name: 'Redesign' });
    const rows = await recentRows(h);
    mount(rows);
    await menu();
    await pick(/Edit/);
    const popover = await slot('record-popover');
    fireEvent.change(popover.getByLabelText('Name'), { target: { value: 'Review' } });
    await act(async () => fireEvent.click(popover.getByRole('button', { name: 'Save' })));

    await waitFor(async () => expect((await saved(rows[0]!.record.id))?.name).toBe('Review'));
  });

  it('deletes a Record from the row menu once confirmed', async () => {
    const record = await seedRecord(h, { project });
    mount(await recentRows(h));
    await menu();
    await pick('Delete');
    fireEvent.click((await slot('delete-confirm')).getByRole('button', { name: 'Delete' }));

    await waitFor(async () => expect(await saved(record.id)).toBeUndefined());
  });

  it('never offers the Timer for deletion', async () => {
    await h.api.record.startTimer();
    mount(await recentRows(h));
    await menu();
    expect(
      (await screen.findByRole('menuitem', { name: 'Delete' })).getAttribute('aria-disabled'),
    ).toBe('true');

    await pick(/Edit/);
    expect((await slot('record-popover')).queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('offers Continue only where the list continues, and not for an Archived Project', async () => {
    await seedRecord(h, { project });
    const other = await seedProject(h, { name: 'Old site' });
    await seedRecord(h, { project: other, start: '2026-09-15T12:00:00.000Z' });
    await h.api.project.archive({ id: other.id });
    const rows = await recentRows(h);
    const onContinue = vi.fn(async () => {});
    mount(rows, onContinue);

    const archivedAt = rows.findIndex((row) => row.project?.id === other.id);
    await menu(archivedAt);
    const item = await screen.findByRole('menuitem', { name: 'Continue' });
    expect(item.getAttribute('aria-disabled')).toBe('true');
    fireEvent.keyDown(item, { key: 'Escape' });

    await menu(1 - archivedAt);
    await pick('Continue');
    expect(onContinue).toHaveBeenCalledWith(rows[1 - archivedAt]);
  });

  it('offers no Continue without onContinue', async () => {
    await seedRecord(h, { project });
    mount(await recentRows(h));
    await menu();
    expect(screen.queryByRole('menuitem', { name: 'Continue' })).toBeNull();
  });

  it('renames and changes the span of a Record', async () => {
    const record = await seedRecord(h, { project, name: 'Redesign' });
    mount([]);
    actions.rename(record, 'Review');
    await waitFor(async () => expect((await saved(record.id))?.name).toBe('Review'));

    actions.update(record, {
      projectId: null,
      name: 'Review',
      start: '2026-09-15T08:00:00.000Z',
      stop: record.stop,
    });
    await waitFor(async () =>
      expect(await saved(record.id)).toMatchObject({
        projectId: null,
        start: '2026-09-15T08:00:00.000Z',
      }),
    );
  });

  it('adds a Record on a day in the Context’s Project, and opens its Name', async () => {
    await h.api.context.set({ workspaceId: h.workspace.id, projectId: project.id });
    mount([]);
    const day = new Date(2026, 8, 14).toISOString();
    await waitFor(() => expect(contextLoaded).toBe(true));
    actions.add(day);

    await waitFor(() => expect(actions.editing).not.toBeNull());
    const added = (await saved(actions.editing!))!;
    expect(added).toMatchObject({ projectId: project.id, name: '' });
    expect(new Date(added.start).getDate()).toBe(14);
  });

  it('reports a failed write on the failure line, and clears it on the next', async () => {
    const record = await seedRecord(h, { project });
    vi.spyOn(window.timeStop.record, 'updateName').mockRejectedValueOnce(
      new Error('Record not found'),
    );
    mount([]);
    actions.rename(record, 'Review');
    expect(await failure()).toBe('Record not found');

    actions.rename(record, 'Review');
    await waitFor(() => expect(slots('record-failure')).toHaveLength(0));
  });

  it('moves the selection, stopping at a failure and resolving to what was written', async () => {
    const records: Record[] = [];
    for (const hour of ['09', '11', '13']) {
      records.push(await seedRecord(h, { start: `2026-09-15T${hour}:00:00.000Z` }));
    }
    const update = window.timeStop.record.update;
    vi.spyOn(window.timeStop.record, 'update').mockImplementation((input: UpdateRecordInput) =>
      input.id === records[1]!.id ? Promise.reject(new Error('Record not found')) : update(input),
    );
    mount([]);

    let done: string[] = [];
    await act(async () => {
      done = await actions.moveAll(records, project.id);
    });
    expect(done).toEqual([records[0]!.id]);
    expect((await saved(records[0]!.id))?.projectId).toBe(project.id);
    expect((await saved(records[2]!.id))?.projectId).not.toBe(project.id);
    expect(await failure()).toBe('Record not found');
  });

  it('deletes the selection', async () => {
    const records = [
      await seedRecord(h, { start: '2026-09-15T09:00:00.000Z' }),
      await seedRecord(h, { start: '2026-09-15T11:00:00.000Z' }),
    ];
    mount([]);

    let done: string[] = [];
    await act(async () => {
      done = await actions.deleteAll(records);
    });
    expect(done).toEqual(records.map(({ id }) => id));
    expect(await recentRows(h)).toEqual([]);
  });
});
