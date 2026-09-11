import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { entityKindSchema } from '@time-stop/domain';
import type { Record, TimeStopApi, Workspace } from '@time-stop/domain';
import { testApi, type TestApi } from '@time-stop/db/testing';
import { importToggl } from './importToggl';
import { parseTogglCsv, type TogglEntry } from './togglCsv';

/** Rows lifted verbatim from a Toggl export: five Projects, two of them billed, no Client column. */
const fixture = readFileSync(
  fileURLToPath(new URL('./fixtures/toggl.csv', import.meta.url)),
  'utf8',
);
const entries = parseTogglCsv(fixture, { zone: 'UTC' });

let t: TestApi;
let api: TimeStopApi;
let fallback: Workspace;

function changeCount(): number {
  return entityKindSchema.options.flatMap((kind) => t.changesOf(kind)).length;
}

async function allRecords(): Promise<Record[]> {
  return api.record.list({ from: '1970-01-01T00:00:00.000Z', to: '2027-01-01T00:00:00.000Z' });
}

beforeEach(async () => {
  t = testApi();
  api = t.api;
  [fallback] = (await api.workspace.list()) as [Workspace];
});

describe('importToggl', () => {
  it('imports the Projects and Records of the export into the default Workspace', async () => {
    const summary = await importToggl(api, entries);

    expect(summary).toMatchObject({
      workspaceId: fallback.id,
      clients: 0,
      projects: 5,
      records: 6,
      skipped: 0,
    });
    expect((await api.project.list()).map((project) => project.name)).toEqual([
      'Dweller',
      'JW',
      'LDSTR',
      'Time Tracker App',
      'hermitt',
    ]);
  });

  it('rates a Project by its Amounts over Toggl’s duration, not the span of the entry', async () => {
    await importToggl(api, entries);
    const rates = new Map(
      (await api.project.list()).map((project) => [project.name, project.rate]),
    );

    expect(rates.get('LDSTR')).toBe(52);
    expect(rates.get('JW')).toBe(50);
    expect(rates.get('hermitt')).toBeNull();
  });

  it('gives every Project a color and no Client, since the export names none', async () => {
    await importToggl(api, entries);
    for (const project of await api.project.list()) {
      expect(project.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(project.clientId).toBeNull();
    }
    expect(await api.client.list()).toEqual([]);
  });

  it('imports a Client and attaches it to the Project when the export carries one', async () => {
    const withClient: TogglEntry[] = entries.map((entry) => ({ ...entry, client: 'Loadster' }));
    await importToggl(api, withClient);
    const [client] = await api.client.list();

    expect(client?.name).toBe('Loadster');
    for (const project of await api.project.list()) expect(project.clientId).toBe(client?.id);
  });

  it('carries start, stop, Name and Project onto each Record', async () => {
    await importToggl(api, entries);
    const records = await allRecords();
    const ldstr = (await api.project.list()).find((project) => project.name === 'LDSTR');

    expect(records.find((record) => record.name === 'L-1291: common ux standards')).toMatchObject({
      workspaceId: fallback.id,
      projectId: ldstr?.id,
      start: '2026-09-07T12:58:51.000Z',
      stop: '2026-09-07T17:01:00.000Z',
    });
  });

  it('lands an entry without a Project in the Workspace it imports into', async () => {
    await importToggl(api, [{ ...entries[0]!, project: null }], { workspaceName: 'Toggl' });
    const [record] = await allRecords();
    const toggl = (await api.workspace.list()).find((workspace) => workspace.name === 'Toggl');

    expect(record).toMatchObject({ projectId: null, workspaceId: toggl?.id });
  });

  it('keeps an entry Toggl left with no duration as a Record of zero length', async () => {
    await importToggl(api, entries);
    const zero = (await allRecords()).find((record) => record.name === 'L-1283: Loadster MCP');
    expect(zero?.stop).toBe(zero?.start);
  });

  it('skips a running entry, which has no stop', async () => {
    const running: TogglEntry[] = [{ ...entries[0]!, stop: null }];
    expect(await importToggl(api, running)).toMatchObject({ records: 0, skipped: 1 });
    expect(await allRecords()).toEqual([]);
  });

  it('writes a Change for every imported entity', async () => {
    const before = changeCount();
    const summary = await importToggl(api, entries);
    expect(changeCount() - before).toBe(
      summary.clients + summary.projects + summary.records + summary.workspaces,
    );
  });

  it('adds nothing on a second run over the same export', async () => {
    await importToggl(api, entries);
    const after = changeCount();

    const summary = await importToggl(api, entries);

    expect(summary).toMatchObject({ workspaces: 0, clients: 0, projects: 0, records: 0 });
    expect(changeCount()).toBe(after);
  });

  it('creates the named Workspace once, with the Currency of the export', async () => {
    const first = await importToggl(api, entries, { workspaceName: 'Toggl' });
    const workspaces = await api.workspace.list();
    const toggl = workspaces.find((workspace) => workspace.name === 'Toggl');

    expect(toggl).toMatchObject({ currency: 'USD' });
    expect(first).toMatchObject({ workspaceId: toggl?.id, workspaces: 1 });

    const second = await importToggl(api, entries, { workspaceName: 'Toggl' });
    expect(second).toMatchObject({ workspaces: 0, records: 0 });
    expect(await api.workspace.list()).toHaveLength(workspaces.length);
  });

  it('leaves the Context as it found it, without touching it', async () => {
    await importToggl(api, entries);
    const [project] = await api.project.list();
    const context = await api.context.set({ workspaceId: fallback.id, projectId: project!.id });
    const setContext = vi.spyOn(api.context, 'set');

    await importToggl(api, entries, { workspaceName: 'Toggl' });

    expect(await api.context.get()).toEqual(context);
    expect(setContext).not.toHaveBeenCalled();
  });

  it('makes one api call per imported Record', async () => {
    const createRecord = vi.spyOn(api.record, 'create');

    const summary = await importToggl(api, entries);

    expect(createRecord).toHaveBeenCalledTimes(summary.records);
    expect(createRecord).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: fallback.id }),
    );
  });
});

describe('importToggl, against a database that already holds Records', () => {
  it('imports the same export again for a second Workspace', async () => {
    await importToggl(api, entries);
    expect(await importToggl(api, entries, { workspaceName: 'Toggl' })).toMatchObject({
      records: 6,
    });
  });
});

describe('importToggl, into a Workspace chosen by id', () => {
  it('imports into that Workspace and creates none', async () => {
    const personal = await api.workspace.create({ name: 'Personal', currency: null });
    const summary = await importToggl(api, entries, { workspaceId: personal.id });

    expect(summary).toMatchObject({ workspaceId: personal.id, workspaces: 0, records: 6 });
    expect((await api.project.list({ workspaceId: personal.id })).length).toBe(5);
  });

  it('refuses a Workspace that is gone', async () => {
    await expect(
      importToggl(api, entries, { workspaceId: fallback.id.replace(/.$/, '0') }),
    ).rejects.toThrow('not found');
  });
});
