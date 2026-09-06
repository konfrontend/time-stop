import { beforeEach, describe, expect, it } from 'vitest';
import { projectInput, testApi, type TestApi } from './testApi.js';

let t: TestApi;
let workspaceId: string;
beforeEach(async () => {
  t = testApi();
  workspaceId = (await t.api.listWorkspaces())[0]!.id;
});

describe('createClient', () => {
  it('adds a Client to a Workspace and appends a create Change', async () => {
    t.clock.now = 20_000;
    const client = await t.api.createClient({ workspaceId, name: 'Northwind' });

    expect(client).toMatchObject({ workspaceId, name: 'Northwind', updatedAt: 20_000 });
    expect(await t.api.listClients({ workspaceId })).toEqual([client]);
    expect(t.changesOf('client')).toEqual([{ entityId: client.id, op: 'create', payload: client }]);
  });

  it('rejects an unknown Workspace', async () => {
    await expect(
      t.api.createClient({ workspaceId: '00000000-0000-7000-8000-000000000000', name: 'x' }),
    ).rejects.toThrow(/Workspace .* not found/);
  });
});

describe('listClients', () => {
  it('filters by Workspace, sorted by name', async () => {
    const other = await t.api.createWorkspace({ name: 'Personal', currency: 'EUR' });
    const b = await t.api.createClient({ workspaceId, name: 'Beta' });
    const a = await t.api.createClient({ workspaceId, name: 'Alpha' });
    const c = await t.api.createClient({ workspaceId: other.id, name: 'Gamma' });

    expect(await t.api.listClients({ workspaceId })).toEqual([a, b]);
    expect(await t.api.listClients()).toEqual([a, b, c]);
  });
});

describe('updateClient', () => {
  it('renames a Client and appends an update Change', async () => {
    const client = await t.api.createClient({ workspaceId, name: 'Northwind' });
    t.clock.now = 30_000;
    const renamed = await t.api.updateClient({ id: client.id, name: 'Northwind Ltd' });

    expect(renamed).toEqual({ ...client, name: 'Northwind Ltd', updatedAt: 30_000 });
    expect(t.changesOf('client').at(-1)).toEqual({
      entityId: client.id,
      op: 'update',
      payload: renamed,
    });
  });
});

describe('deleteClient', () => {
  it('removes the Client and detaches its Projects, appending Changes for both', async () => {
    const client = await t.api.createClient({ workspaceId, name: 'Northwind' });
    const project = await t.api.createProject({
      ...projectInput,
      workspaceId,
      clientId: client.id,
    });
    t.clock.now = 40_000;

    await t.api.deleteClient({ id: client.id });

    expect(await t.api.listClients()).toEqual([]);
    expect(await t.api.listProjects()).toEqual([{ ...project, clientId: null, updatedAt: 40_000 }]);
    expect(t.changesOf('client').at(-1)).toEqual({
      entityId: client.id,
      op: 'delete',
      payload: {},
    });
    expect(t.changesOf('project').at(-1)).toMatchObject({ entityId: project.id, op: 'update' });
  });
});
