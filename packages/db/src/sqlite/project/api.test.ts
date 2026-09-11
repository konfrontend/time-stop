import { beforeEach, describe, expect, it, vi } from 'vitest';
import { projectInput, testApi, type TestApi } from '../testApi.js';

let t: TestApi;
let workspaceId: string;
beforeEach(async () => {
  t = testApi();
  workspaceId = (await t.api.workspace.list())[0]!.id;
});

describe('project.create', () => {
  it('adds a Project to a Workspace and appends a create Change', async () => {
    t.clock.now = 20_000;
    const project = await t.api.project.create({
      ...projectInput,
      workspaceId,
      limitMax: 40,
      limitPeriod: 'week',
      startDate: '2026-01-01',
    });

    expect(project).toMatchObject({
      workspaceId,
      clientId: null,
      name: 'Acme API',
      rate: 110,
      limitMin: null,
      limitMax: 40,
      limitPeriod: 'week',
      startDate: '2026-01-01',
      endDate: null,
      color: '#4f6bd9',
      archived: false,
      updatedAt: '1970-01-01T00:00:20.000Z',
    });
    expect(await t.api.project.list()).toEqual([project]);
    expect(t.changesOf('project')).toEqual([
      { entityId: project.id, op: 'create', payload: project },
    ]);
  });

  it('rejects a Client from another Workspace', async () => {
    const other = await t.api.workspace.create({ name: 'Personal', currency: 'EUR' });
    const client = await t.api.client.create({ workspaceId: other.id, name: 'Me' });

    await expect(
      t.api.project.create({ ...projectInput, workspaceId, clientId: client.id }),
    ).rejects.toThrow(/same Workspace/);
    expect(await t.api.project.list()).toEqual([]);
  });
});

describe('project.list', () => {
  it('filters by Workspace and Archived, sorted by name', async () => {
    const other = await t.api.workspace.create({ name: 'Personal', currency: 'EUR' });
    const b = await t.api.project.create({ ...projectInput, workspaceId, name: 'Beta' });
    const a = await t.api.project.create({ ...projectInput, workspaceId, name: 'Alpha' });
    const c = await t.api.project.create({ ...projectInput, workspaceId: other.id, name: 'Gamma' });
    const archived = await t.api.project.archive({ id: b.id });

    expect(await t.api.project.list()).toEqual([a, archived, c]);
    expect(await t.api.project.list({ workspaceId })).toEqual([a, archived]);
    expect(await t.api.project.list({ workspaceId, archived: false })).toEqual([a]);
    expect(await t.api.project.list({ archived: true })).toEqual([archived]);
  });
});

describe('project.update', () => {
  it('changes the fields and appends an update Change', async () => {
    const client = await t.api.client.create({ workspaceId, name: 'Acme' });
    const project = await t.api.project.create({ ...projectInput, workspaceId });
    t.clock.now = 30_000;
    const updated = await t.api.project.update({
      ...projectInput,
      id: project.id,
      clientId: client.id,
      name: 'Acme API v2',
      rate: 120,
      color: '#000000',
    });

    expect(updated).toEqual({
      ...project,
      clientId: client.id,
      name: 'Acme API v2',
      rate: 120,
      color: '#000000',
      updatedAt: '1970-01-01T00:00:30.000Z',
    });
    expect(await t.api.project.list()).toEqual([updated]);
    expect(t.changesOf('project').at(-1)).toEqual({
      entityId: project.id,
      op: 'update',
      payload: updated,
    });
  });
});

describe('project.archive', () => {
  it('hides the Project from the Tracker picker, refuses new Records, keeps history and reverses', async () => {
    const project = await t.api.project.create({ ...projectInput, workspaceId });
    await t.api.context.set({ workspaceId, projectId: project.id });
    const history = await t.api.record.startTimer();
    await t.api.record.stopTimer();
    t.clock.now = 30_000;

    const archived = await t.api.project.archive({ id: project.id });
    expect(archived).toEqual({ ...project, archived: true, updatedAt: '1970-01-01T00:00:30.000Z' });
    expect(await t.api.project.list({ archived: false })).toEqual([]);
    expect(t.changesOf('project').at(-1)).toEqual({
      entityId: project.id,
      op: 'update',
      payload: archived,
    });
    expect(await t.allRecords()).toEqual([expect.objectContaining({ id: history.id })]);

    // Archiving drops the Project from the Context so the next Timer lands in the Workspace only.
    expect(await t.api.context.get()).toEqual({ workspaceId, projectId: null });
    await expect(t.api.context.set({ workspaceId, projectId: project.id })).rejects.toThrow(
      /Archived/,
    );

    t.clock.now = 40_000;
    const unarchived = await t.api.project.unarchive({ id: project.id });
    expect(unarchived).toEqual({
      ...project,
      archived: false,
      updatedAt: '1970-01-01T00:00:40.000Z',
    });
    expect(await t.api.project.list({ archived: false })).toEqual([unarchived]);
  });
});

describe('project.delete', () => {
  it('reports the detached Timer to subscribers', async () => {
    const project = await t.api.project.create({ ...projectInput, workspaceId });
    await t.api.context.set({ workspaceId, projectId: project.id });
    const timer = await t.api.record.startTimer();
    const listener = vi.fn();
    t.api.record.onTimerChanged(listener);
    t.clock.now = 50_000;

    await t.api.project.delete({ id: project.id });

    expect(listener).toHaveBeenCalledWith({
      ...timer,
      projectId: null,
      updatedAt: '1970-01-01T00:00:50.000Z',
    });
  });

  it('detaches its Records, keeping their Workspace, and appends Changes for all', async () => {
    const project = await t.api.project.create({ ...projectInput, workspaceId });
    await t.api.context.set({ workspaceId, projectId: project.id });
    const record = await t.api.record.startTimer();
    await t.api.record.stopTimer();
    t.clock.now = 50_000;

    await t.api.project.delete({ id: project.id });

    expect(await t.api.project.list()).toEqual([]);
    expect(await t.allRecords()).toEqual([
      {
        ...record,
        stop: '1970-01-01T00:00:10.000Z',
        projectId: null,
        updatedAt: '1970-01-01T00:00:50.000Z',
      },
    ]);
    expect(await t.api.context.get()).toEqual({ workspaceId, projectId: null });
    expect(t.changesOf('project').at(-1)).toEqual({
      entityId: project.id,
      op: 'delete',
      payload: {},
    });
    expect(t.changesOf('record').at(-1)).toMatchObject({
      entityId: record.id,
      op: 'update',
      payload: expect.objectContaining({ projectId: null }),
    });
  });
});
