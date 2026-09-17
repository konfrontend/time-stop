import { beforeEach, describe, expect, it } from 'vitest';
import { projectInput, testApi, type TestApi } from '../testApi.js';

let t: TestApi;
beforeEach(() => {
  t = testApi();
});

describe('workspace.list', () => {
  it('starts with the seeded default Workspace', async () => {
    expect(await t.api.workspace.list()).toEqual([
      expect.objectContaining({ name: 'Default', currency: null }),
    ]);
  });
});

describe('workspace.create', () => {
  it('adds a Workspace with a Currency and appends a create Change', async () => {
    t.clock.now = 20_000;
    const workspace = await t.api.workspace.create({
      name: 'Personal',
      currency: 'EUR',
      color: '#4f6bd9',
    });

    expect(workspace).toMatchObject({
      name: 'Personal',
      currency: 'EUR',
      createdAt: '1970-01-01T00:00:20.000Z',
      updatedAt: '1970-01-01T00:00:20.000Z',
    });
    expect((await t.api.workspace.list()).map((w) => w.name)).toEqual(['Default', 'Personal']);
    expect(t.changesOf('workspace').at(-1)).toEqual({
      entityId: workspace.id,
      op: 'create',
      payload: workspace,
    });
  });
});

describe('workspace.update', () => {
  it('renames and re-prices a Workspace and appends an update Change', async () => {
    const [seeded] = await t.api.workspace.list();
    t.clock.now = 30_000;
    const updated = await t.api.workspace.update({
      id: seeded!.id,
      name: 'Work',
      currency: 'USDT',
      color: '#4f6bd9',
    });

    expect(updated).toEqual({
      ...seeded,
      name: 'Work',
      currency: 'USDT',
      updatedAt: '1970-01-01T00:00:30.000Z',
    });
    expect(await t.api.workspace.list()).toEqual([updated]);
    expect(t.changesOf('workspace').at(-1)).toEqual({
      entityId: seeded!.id,
      op: 'update',
      payload: updated,
    });
  });

  it('rejects an unknown Workspace', async () => {
    await expect(
      t.api.workspace.update({
        id: '00000000-0000-7000-8000-000000000000',
        name: 'x',
        currency: 'USD',
        color: '#4f6bd9',
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe('workspace.delete', () => {
  it('refuses the default Workspace', async () => {
    const [seeded] = await t.api.workspace.list();
    await expect(t.api.workspace.delete({ id: seeded!.id })).rejects.toThrow(/default Workspace/);
    expect(await t.api.workspace.list()).toHaveLength(1);
  });

  it('takes the Workspace’s Clients, Projects and Records with it, each with a delete Change', async () => {
    const workspace = await t.api.workspace.create({
      name: 'Personal',
      currency: 'EUR',
      color: '#4f6bd9',
    });
    const client = await t.api.client.create({ workspaceId: workspace.id, name: 'Me' });
    const project = await t.api.project.create({
      ...projectInput,
      workspaceId: workspace.id,
      clientId: client.id,
    });
    await t.api.context.set({ workspaceId: workspace.id, projectId: project.id });
    const record = await t.api.record.startTimer();
    await t.api.record.stopTimer();
    t.clock.now = 50_000;

    await t.api.workspace.delete({ id: workspace.id });

    expect(await t.api.workspace.list()).toHaveLength(1);
    expect(await t.api.client.list()).toEqual([]);
    expect(await t.api.project.list()).toEqual([]);
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
    const [seeded] = await t.api.workspace.list();
    const workspace = await t.api.workspace.create({
      name: 'Personal',
      currency: 'EUR',
      color: '#4f6bd9',
    });
    await t.api.context.set({ workspaceId: workspace.id, projectId: null });

    await t.api.workspace.delete({ id: workspace.id });

    expect(await t.api.context.get()).toEqual({ workspaceId: seeded!.id, projectId: null });
  });
});

describe('record.count', () => {
  it('counts the Records of a Workspace or a Project', async () => {
    const [seeded] = await t.api.workspace.list();
    const project = await t.api.project.create({ ...projectInput, workspaceId: seeded!.id });
    await t.api.record.startTimer();
    await t.api.context.set({ workspaceId: seeded!.id, projectId: project.id });
    await t.api.record.startTimer();
    await t.api.record.stopTimer();

    expect(await t.api.record.count({ workspaceId: seeded!.id })).toBe(2);
    expect(await t.api.record.count({ projectId: project.id })).toBe(1);
  });
});
