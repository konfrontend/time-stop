import { beforeEach, describe, expect, it } from 'vitest';
import { projectInput, testApi, type TestApi } from '../testApi.js';

let t: TestApi;
let workspaceId: string;
beforeEach(async () => {
  t = testApi();
  workspaceId = (await t.api.workspace.list())[0]!.id;
});

describe('client.create', () => {
  it('adds a Client to a Workspace and appends a create Change', async () => {
    t.clock.now = 20_000;
    const client = await t.api.client.create({ workspaceId, name: 'Northwind' });

    expect(client).toMatchObject({ workspaceId, name: 'Northwind', updatedAt: 20_000 });
    expect(await t.api.client.list({ workspaceId })).toEqual([client]);
    expect(t.changesOf('client')).toEqual([{ entityId: client.id, op: 'create', payload: client }]);
  });

  it('rejects an unknown Workspace', async () => {
    await expect(
      t.api.client.create({ workspaceId: '00000000-0000-7000-8000-000000000000', name: 'x' }),
    ).rejects.toThrow(/Workspace .* not found/);
  });
});

describe('client.list', () => {
  it('filters by Workspace, sorted by name', async () => {
    const other = await t.api.workspace.create({ name: 'Personal', currency: 'EUR' });
    const b = await t.api.client.create({ workspaceId, name: 'Beta' });
    const a = await t.api.client.create({ workspaceId, name: 'Alpha' });
    const c = await t.api.client.create({ workspaceId: other.id, name: 'Gamma' });

    expect(await t.api.client.list({ workspaceId })).toEqual([a, b]);
    expect(await t.api.client.list()).toEqual([a, b, c]);
  });
});

describe('client.update', () => {
  it('renames a Client and appends an update Change', async () => {
    const client = await t.api.client.create({ workspaceId, name: 'Northwind' });
    t.clock.now = 30_000;
    const renamed = await t.api.client.update({ id: client.id, name: 'Northwind Ltd' });

    expect(renamed).toEqual({ ...client, name: 'Northwind Ltd', updatedAt: 30_000 });
    expect(t.changesOf('client').at(-1)).toEqual({
      entityId: client.id,
      op: 'update',
      payload: renamed,
    });
  });
});

describe('client.delete', () => {
  it('removes the Client and detaches its Projects, appending Changes for both', async () => {
    const client = await t.api.client.create({ workspaceId, name: 'Northwind' });
    const project = await t.api.project.create({
      ...projectInput,
      workspaceId,
      clientId: client.id,
    });
    t.clock.now = 40_000;

    await t.api.client.delete({ id: client.id });

    expect(await t.api.client.list()).toEqual([]);
    expect(await t.api.project.list()).toEqual([{ ...project, clientId: null, updatedAt: 40_000 }]);
    expect(t.changesOf('client').at(-1)).toEqual({
      entityId: client.id,
      op: 'delete',
      payload: {},
    });
    expect(t.changesOf('project').at(-1)).toMatchObject({ entityId: project.id, op: 'update' });
  });
});
