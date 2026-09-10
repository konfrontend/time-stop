import { beforeEach, describe, expect, it, vi } from 'vitest';
import { projectInput, testApi, type TestApi } from './testApi.js';

let t: TestApi;
let workspaceId: string;
beforeEach(async () => {
  t = testApi();
  workspaceId = (await t.api.listWorkspaces())[0]!.id;
});

describe('createProject', () => {
  it('adds a Project to a Workspace and appends a create Change', async () => {
    t.clock.now = 20_000;
    const project = await t.api.createProject({
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
      updatedAt: 20_000,
    });
    expect(await t.api.listProjects()).toEqual([project]);
    expect(t.changesOf('project')).toEqual([
      { entityId: project.id, op: 'create', payload: project },
    ]);
  });

  it('rejects a Client from another Workspace', async () => {
    const other = await t.api.createWorkspace({ name: 'Personal', currency: 'EUR' });
    const client = await t.api.createClient({ workspaceId: other.id, name: 'Me' });

    await expect(
      t.api.createProject({ ...projectInput, workspaceId, clientId: client.id }),
    ).rejects.toThrow(/same Workspace/);
    expect(await t.api.listProjects()).toEqual([]);
  });
});

describe('listProjects', () => {
  it('filters by Workspace and Archived, sorted by name', async () => {
    const other = await t.api.createWorkspace({ name: 'Personal', currency: 'EUR' });
    const b = await t.api.createProject({ ...projectInput, workspaceId, name: 'Beta' });
    const a = await t.api.createProject({ ...projectInput, workspaceId, name: 'Alpha' });
    const c = await t.api.createProject({ ...projectInput, workspaceId: other.id, name: 'Gamma' });
    const archived = await t.api.archiveProject({ id: b.id });

    expect(await t.api.listProjects()).toEqual([a, archived, c]);
    expect(await t.api.listProjects({ workspaceId })).toEqual([a, archived]);
    expect(await t.api.listProjects({ workspaceId, archived: false })).toEqual([a]);
    expect(await t.api.listProjects({ archived: true })).toEqual([archived]);
  });
});

describe('updateProject', () => {
  it('changes the fields and appends an update Change', async () => {
    const client = await t.api.createClient({ workspaceId, name: 'Acme' });
    const project = await t.api.createProject({ ...projectInput, workspaceId });
    t.clock.now = 30_000;
    const updated = await t.api.updateProject({
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
      updatedAt: 30_000,
    });
    expect(await t.api.listProjects()).toEqual([updated]);
    expect(t.changesOf('project').at(-1)).toEqual({
      entityId: project.id,
      op: 'update',
      payload: updated,
    });
  });

  it('leaves the Rate of existing Records untouched', async () => {
    const project = await t.api.createProject({ ...projectInput, workspaceId, rate: 100 });
    await t.api.setContext({ workspaceId, projectId: project.id });
    const before = await t.api.startTimer();
    await t.api.stopTimer();

    await t.api.updateProject({ ...projectInput, id: project.id, rate: 150 });
    const after = await t.api.startTimer();

    expect((await t.allRecords()).find((r) => r.id === before.id)?.rate).toBe(100);
    expect(after.rate).toBe(150);
  });
});

describe('archiveProject', () => {
  it('hides the Project from the Tracker picker, refuses new Records, keeps history and reverses', async () => {
    const project = await t.api.createProject({ ...projectInput, workspaceId });
    await t.api.setContext({ workspaceId, projectId: project.id });
    const history = await t.api.startTimer();
    await t.api.stopTimer();
    t.clock.now = 30_000;

    const archived = await t.api.archiveProject({ id: project.id });
    expect(archived).toEqual({ ...project, archived: true, updatedAt: 30_000 });
    expect(await t.api.listProjects({ archived: false })).toEqual([]);
    expect(t.changesOf('project').at(-1)).toEqual({
      entityId: project.id,
      op: 'update',
      payload: archived,
    });
    expect(await t.allRecords()).toEqual([expect.objectContaining({ id: history.id })]);

    // Archiving drops the Project from the Context so the next Timer lands in the Workspace only.
    expect(await t.api.getContext()).toEqual({ workspaceId, projectId: null });
    await expect(t.api.setContext({ workspaceId, projectId: project.id })).rejects.toThrow(
      /Archived/,
    );

    t.clock.now = 40_000;
    const unarchived = await t.api.unarchiveProject({ id: project.id });
    expect(unarchived).toEqual({ ...project, archived: false, updatedAt: 40_000 });
    expect(await t.api.listProjects({ archived: false })).toEqual([unarchived]);
  });
});

describe('deleteProject', () => {
  it('reports the detached Timer to subscribers', async () => {
    const project = await t.api.createProject({ ...projectInput, workspaceId });
    await t.api.setContext({ workspaceId, projectId: project.id });
    const timer = await t.api.startTimer();
    const listener = vi.fn();
    t.api.subscribeTimer(listener);
    t.clock.now = 50_000;

    await t.api.deleteProject({ id: project.id });

    expect(listener).toHaveBeenCalledWith({ ...timer, projectId: null, updatedAt: 50_000 });
  });

  it('detaches its Records, keeping their Workspace, and appends Changes for all', async () => {
    const project = await t.api.createProject({ ...projectInput, workspaceId });
    await t.api.setContext({ workspaceId, projectId: project.id });
    const record = await t.api.startTimer();
    await t.api.stopTimer();
    t.clock.now = 50_000;

    await t.api.deleteProject({ id: project.id });

    expect(await t.api.listProjects()).toEqual([]);
    expect(await t.allRecords()).toEqual([
      { ...record, stop: 10_000, projectId: null, updatedAt: 50_000 },
    ]);
    expect(await t.api.getContext()).toEqual({ workspaceId, projectId: null });
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
