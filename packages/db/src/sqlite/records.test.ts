import { beforeEach, describe, expect, it } from 'vitest';
import type { Project, Workspace } from '@time-stop/domain';
import { createSqliteApi } from './api.js';
import { projectInput, testApi, UNKNOWN_ID, type TestApi } from './testApi.js';

const HOUR = 3_600_000;
const base = Date.UTC(2026, 8, 15, 9);

let t: TestApi;
let work: Workspace;
let personal: Workspace;
let acme: Project;
let unpaid: Project;

const entry = { name: 'Redesign', start: base, stop: base + HOUR };

beforeEach(async () => {
  t = testApi();
  t.clock.now = base + 5 * HOUR;
  [work] = (await t.api.listWorkspaces()) as [Workspace];
  personal = await t.api.createWorkspace({ name: 'Personal', currency: null });
  acme = await t.api.createProject({ ...projectInput, workspaceId: work.id });
  unpaid = await t.api.createProject({
    ...projectInput,
    workspaceId: personal.id,
    name: 'Meditation',
    rate: null,
  });
});

describe('createRecord', () => {
  it('creates a stopped Record in the Workspace and Project', async () => {
    const record = await t.api.createRecord({ ...entry, workspaceId: work.id, projectId: acme.id });

    expect(record).toMatchObject({
      workspaceId: work.id,
      projectId: acme.id,
      actorId: t.identity.actorId,
      name: 'Redesign',
      start: base,
      stop: base + HOUR,
      updatedAt: base + 5 * HOUR,
    });
    expect(await t.allRecords()).toEqual([record]);
    expect(t.changesOf('record')).toEqual([{ entityId: record.id, op: 'create', payload: record }]);
  });

  it('lands in the given Workspace without a Project', async () => {
    const record = await t.api.createRecord({
      ...entry,
      workspaceId: personal.id,
      projectId: null,
    });

    expect(record).toMatchObject({ workspaceId: personal.id, projectId: null });
  });

  it('ignores the Context', async () => {
    await t.api.setContext({ workspaceId: work.id, projectId: acme.id });
    const record = await t.api.createRecord({
      ...entry,
      workspaceId: personal.id,
      projectId: null,
    });
    expect(record).toMatchObject({ workspaceId: personal.id, projectId: null });
  });

  it('refuses a Project outside the given Workspace', async () => {
    await expect(
      t.api.createRecord({ ...entry, workspaceId: work.id, projectId: unpaid.id }),
    ).rejects.toThrow('same Workspace');
    expect(await t.allRecords()).toEqual([]);
  });

  it('refuses an unknown Workspace', async () => {
    await expect(
      t.api.createRecord({ ...entry, workspaceId: UNKNOWN_ID, projectId: null }),
    ).rejects.toThrow('not found');
  });

  it('leaves the Timer alone', async () => {
    const timer = await t.api.startTimer();
    await t.api.createRecord({ ...entry, workspaceId: work.id, projectId: null });
    expect(await t.api.getTimer()).toEqual(timer);
  });

  it('refuses an Archived Project', async () => {
    await t.api.archiveProject({ id: acme.id });
    await expect(
      t.api.createRecord({ ...entry, workspaceId: work.id, projectId: acme.id }),
    ).rejects.toThrow('Archived');
  });
});

describe('updateRecord', () => {
  it('changes Name, start and stop and appends an update Change', async () => {
    const record = await t.api.createRecord({ ...entry, workspaceId: work.id, projectId: acme.id });
    t.clock.now = base + 6 * HOUR;
    const updated = await t.api.updateRecord({
      id: record.id,
      projectId: acme.id,
      name: 'Review',
      start: base + HOUR,
      stop: base + 3 * HOUR,
    });

    expect(updated).toEqual({
      ...record,
      name: 'Review',
      start: base + HOUR,
      stop: base + 3 * HOUR,
      updatedAt: base + 6 * HOUR,
    });
    expect(await t.allRecords()).toEqual([updated]);
    expect(t.changesOf('record').at(-1)).toEqual({
      entityId: record.id,
      op: 'update',
      payload: updated,
    });
  });

  it('re-derives the Workspace from a new Project', async () => {
    const record = await t.api.createRecord({ ...entry, workspaceId: work.id, projectId: acme.id });
    const moved = await t.api.updateRecord({ ...record, projectId: unpaid.id });
    expect(moved).toMatchObject({ workspaceId: personal.id, projectId: unpaid.id });

    const back = await t.api.updateRecord({ ...moved, projectId: acme.id });
    expect(back).toMatchObject({ workspaceId: work.id, projectId: acme.id });
  });

  it('keeps the Workspace when the Project is removed', async () => {
    const record = await t.api.createRecord({ ...entry, workspaceId: work.id, projectId: acme.id });
    expect(await t.api.updateRecord({ ...record, projectId: null })).toMatchObject({
      workspaceId: work.id,
      projectId: null,
    });
  });

  it('refuses to turn a stopped Record into a Timer', async () => {
    const record = await t.api.createRecord({ ...entry, workspaceId: work.id, projectId: null });
    await expect(t.api.updateRecord({ ...record, stop: null })).rejects.toThrow(
      'second running Timer',
    );
  });

  it('edits the Timer in place and keeps it running', async () => {
    const timer = await t.api.startTimer();
    const named = await t.api.updateRecord({ ...timer, name: 'Live' });
    expect(named).toMatchObject({ name: 'Live', stop: null });
    expect(await t.api.getTimer()).toEqual(named);
  });

  it('stopping the Timer by giving it a stop tells Timer listeners', async () => {
    const timer = await t.api.startTimer();
    const seen: Array<unknown> = [];
    t.api.subscribeTimer((next) => seen.push(next));
    await t.api.updateRecord({ ...timer, stop: timer.start + HOUR });
    expect(seen).toEqual([null]);
    expect(await t.api.getTimer()).toBeNull();
  });

  it('refuses an Archived Project', async () => {
    const record = await t.api.createRecord({ ...entry, workspaceId: work.id, projectId: null });
    await t.api.archiveProject({ id: acme.id });
    await expect(t.api.updateRecord({ ...record, projectId: acme.id })).rejects.toThrow('Archived');
  });

  it('refuses another Actor’s Record', async () => {
    const record = await t.api.createRecord({ ...entry, workspaceId: work.id, projectId: null });
    const other = createSqliteApi({ db: t.db, ...t.identity, actorId: UNKNOWN_ID });
    await expect(other.updateRecord({ ...record, name: 'x' })).rejects.toThrow('not found');
  });
});

describe('deleteRecord', () => {
  it('removes the Record and appends a delete Change', async () => {
    const record = await t.api.createRecord({ ...entry, workspaceId: work.id, projectId: acme.id });
    t.clock.now = base + 6 * HOUR;
    await t.api.deleteRecord({ id: record.id });

    expect(await t.allRecords()).toEqual([]);
    expect(t.changesOf('record').at(-1)).toEqual({
      entityId: record.id,
      op: 'delete',
      payload: {},
    });
  });

  it('deleting the Timer clears it', async () => {
    const timer = await t.api.startTimer();
    await t.api.deleteRecord({ id: timer.id });
    expect(await t.api.getTimer()).toBeNull();
  });

  it('refuses an unknown Record', async () => {
    await expect(t.api.deleteRecord({ id: crypto.randomUUID() })).rejects.toThrow('not found');
  });
});

describe('listRecentNames', () => {
  it('lists distinct Names of the Project, most recently started first, skipping empty ones', async () => {
    const at = (h: number) => ({ start: base + h * HOUR, stop: base + (h + 1) * HOUR });
    await t.api.createRecord({ workspaceId: work.id, projectId: acme.id, name: 'Old', ...at(0) });
    await t.api.createRecord({
      workspaceId: work.id,
      projectId: acme.id,
      name: 'Review',
      ...at(1),
    });
    await t.api.createRecord({ workspaceId: work.id, projectId: acme.id, name: '', ...at(2) });
    await t.api.createRecord({ workspaceId: work.id, projectId: acme.id, name: 'Old', ...at(3) });
    await t.api.createRecord({
      workspaceId: personal.id,
      projectId: unpaid.id,
      name: 'Sit',
      ...at(4),
    });
    await t.api.createRecord({ workspaceId: work.id, projectId: null, name: 'Loose', ...at(5) });

    expect(await t.api.listRecentNames({ projectId: acme.id })).toEqual(['Old', 'Review']);
    expect(await t.api.listRecentNames({ projectId: null })).toEqual(['Loose']);
  });
});
