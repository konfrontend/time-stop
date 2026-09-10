import { beforeEach, describe, expect, it } from 'vitest';
import { projectInput, testApi, type TestApi } from './testApi.js';

let t: TestApi;
beforeEach(() => {
  t = testApi();
});

describe('listWorkspaces', () => {
  it('starts with the seeded default Workspace', async () => {
    expect(await t.api.listWorkspaces()).toEqual([
      expect.objectContaining({ name: 'Default', currency: null }),
    ]);
  });
});

describe('createWorkspace', () => {
  it('adds a Workspace with a Currency and appends a create Change', async () => {
    t.clock.now = 20_000;
    const workspace = await t.api.createWorkspace({ name: 'Personal', currency: 'EUR' });

    expect(workspace).toMatchObject({
      name: 'Personal',
      currency: 'EUR',
      createdAt: 20_000,
      updatedAt: 20_000,
    });
    expect((await t.api.listWorkspaces()).map((w) => w.name)).toEqual(['Default', 'Personal']);
    expect(t.changesOf('workspace').at(-1)).toEqual({
      entityId: workspace.id,
      op: 'create',
      payload: workspace,
    });
  });
});

describe('updateWorkspace', () => {
  it('renames and re-prices a Workspace and appends an update Change', async () => {
    const [seeded] = await t.api.listWorkspaces();
    t.clock.now = 30_000;
    const updated = await t.api.updateWorkspace({ id: seeded!.id, name: 'Work', currency: 'USDT' });

    expect(updated).toEqual({ ...seeded, name: 'Work', currency: 'USDT', updatedAt: 30_000 });
    expect(await t.api.listWorkspaces()).toEqual([updated]);
    expect(t.changesOf('workspace').at(-1)).toEqual({
      entityId: seeded!.id,
      op: 'update',
      payload: updated,
    });
  });

  it('rejects an unknown Workspace', async () => {
    await expect(
      t.api.updateWorkspace({
        id: '00000000-0000-7000-8000-000000000000',
        name: 'x',
        currency: 'USD',
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe('deleteWorkspace', () => {
  it('refuses the default Workspace', async () => {
    const [seeded] = await t.api.listWorkspaces();
    await expect(t.api.deleteWorkspace({ id: seeded!.id })).rejects.toThrow(/default Workspace/);
    expect(await t.api.listWorkspaces()).toHaveLength(1);
  });

  it('takes the Workspace’s Clients, Projects and Records with it, each with a delete Change', async () => {
    const workspace = await t.api.createWorkspace({ name: 'Personal', currency: 'EUR' });
    const client = await t.api.createClient({ workspaceId: workspace.id, name: 'Me' });
    const project = await t.api.createProject({
      ...projectInput,
      workspaceId: workspace.id,
      clientId: client.id,
    });
    await t.api.setContext({ workspaceId: workspace.id, projectId: project.id });
    const record = await t.api.startTimer();
    await t.api.stopTimer();
    t.clock.now = 50_000;

    await t.api.deleteWorkspace({ id: workspace.id });

    expect(await t.api.listWorkspaces()).toHaveLength(1);
    expect(await t.api.listClients()).toEqual([]);
    expect(await t.api.listProjects()).toEqual([]);
    expect(await t.allRecords()).toEqual([]);
    expect(t.changesOf('workspace').at(-1)).toEqual({
      entityId: workspace.id,
      op: 'delete',
      payload: {},
    });
    expect(t.changesOf('client').at(-1)).toEqual({
      entityId: client.id,
      op: 'delete',
      payload: {},
    });
    expect(t.changesOf('project').at(-1)).toEqual({
      entityId: project.id,
      op: 'delete',
      payload: {},
    });
    expect(t.changesOf('record').at(-1)).toEqual({
      entityId: record.id,
      op: 'delete',
      payload: {},
    });
  });

  it('moves the Context back to the default Workspace', async () => {
    const [seeded] = await t.api.listWorkspaces();
    const workspace = await t.api.createWorkspace({ name: 'Personal', currency: 'EUR' });
    await t.api.setContext({ workspaceId: workspace.id, projectId: null });

    await t.api.deleteWorkspace({ id: workspace.id });

    expect(await t.api.getContext()).toEqual({ workspaceId: seeded!.id, projectId: null });
  });
});

describe('countRecords', () => {
  it('counts the Records of a Workspace or a Project', async () => {
    const [seeded] = await t.api.listWorkspaces();
    const project = await t.api.createProject({ ...projectInput, workspaceId: seeded!.id });
    await t.api.startTimer();
    await t.api.setContext({ workspaceId: seeded!.id, projectId: project.id });
    await t.api.startTimer();
    await t.api.stopTimer();

    expect(await t.api.countRecords({ workspaceId: seeded!.id })).toBe(2);
    expect(await t.api.countRecords({ projectId: project.id })).toBe(1);
  });
});
