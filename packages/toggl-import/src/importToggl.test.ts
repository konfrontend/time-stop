import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { bootstrap, createSqliteApi, openSqlite, sqliteSchema } from '@time-stop/db';
import type { TimeStopApi, Workspace } from '@time-stop/domain';
import { importToggl } from './importToggl.js';
import { parseTogglCsv } from './togglCsv.js';

const fixture = readFileSync(
  fileURLToPath(new URL('./fixtures/toggl.csv', import.meta.url)),
  'utf8',
);
const entries = parseTogglCsv(fixture, { zone: 'UTC' });

let api: TimeStopApi;
let db: ReturnType<typeof openSqlite>;
let fallback: Workspace;

function changeCount(): number {
  return db.select().from(sqliteSchema.changes).all().length;
}

beforeEach(async () => {
  db = openSqlite(':memory:');
  const { seeded: _seeded, ...identity } = bootstrap(db);
  api = createSqliteApi({ db, ...identity });
  [fallback] = (await api.listWorkspaces()) as [Workspace];
});

describe('importToggl', () => {
  it('imports Clients, Projects and Records into the default Workspace', async () => {
    const summary = await importToggl(api, entries);

    expect(summary).toMatchObject({
      workspaceId: fallback.id,
      clients: 1,
      projects: 2,
      records: 4,
      skipped: 1,
    });
    expect((await api.listClients()).map((client) => client.name)).toEqual(['Acme']);
    expect((await api.listProjects()).map((project) => project.name)).toEqual([
      'Acme API',
      'Wellbeing',
    ]);
  });

  it('gives a Project its Client, a color and the Rate the Amounts imply', async () => {
    await importToggl(api, entries);
    const [acme] = await api.listProjects();
    const [client] = await api.listClients();

    expect(acme).toMatchObject({ clientId: client?.id, rate: 110 });
    expect(acme?.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('leaves a Project without Amounts unrated and without a Client', async () => {
    await importToggl(api, entries);
    const wellbeing = (await api.listProjects()).find((p) => p.name === 'Wellbeing');
    expect(wellbeing).toMatchObject({ rate: null, clientId: null });
  });

  it('carries start, stop, Name, Billable and the Project’s Rate onto each Record', async () => {
    await importToggl(api, entries);
    const records = await api.listRecords({ from: 0, to: Date.UTC(2027, 0, 1) });

    expect(records.find((record) => record.name === 'Redesign')).toMatchObject({
      workspaceId: fallback.id,
      start: Date.UTC(2026, 8, 7, 12),
      stop: Date.UTC(2026, 8, 7, 14),
      rate: 110,
      billable: true,
    });
    expect(records.find((record) => record.name === 'Meditation')).toMatchObject({
      rate: null,
      billable: false,
    });
    expect(records.find((record) => record.name === 'Reading, notes')).toMatchObject({
      projectId: null,
      workspaceId: fallback.id,
    });
  });

  it('honours Toggl’s Billable flag over the Rate the Project carries', async () => {
    const unbilled = entries.map((entry) => ({ ...entry, billable: false }));
    await importToggl(api, unbilled);
    const records = await api.listRecords({ from: 0, to: Date.UTC(2027, 0, 1) });
    expect(records.every((record) => !record.billable)).toBe(true);
  });

  it('skips a running entry, which has no stop', async () => {
    await importToggl(api, entries);
    const records = await api.listRecords({ from: 0, to: Date.UTC(2027, 0, 1) });
    expect(records.map((record) => record.name)).not.toContain('Running entry');
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
    const workspaces = await api.listWorkspaces();
    const toggl = workspaces.find((workspace) => workspace.name === 'Toggl');

    expect(toggl).toMatchObject({ currency: 'USD' });
    expect(first).toMatchObject({ workspaceId: toggl?.id, workspaces: 1 });

    const second = await importToggl(api, entries, { workspaceName: 'Toggl' });
    expect(second).toMatchObject({ workspaces: 0, records: 0 });
    expect(await api.listWorkspaces()).toHaveLength(workspaces.length);
  });

  it('leaves the Context as it found it', async () => {
    const context = await api.getContext();
    await importToggl(api, entries, { workspaceName: 'Toggl' });
    expect(await api.getContext()).toEqual(context);
  });
});

describe('the Rate a rounded export implies', () => {
  it('divides the Amount by Toggl’s own duration, not by the span of the entry', async () => {
    const rounded = entries.map((entry) => ({ ...entry, duration: 90 * 60 * 1000 }));
    await importToggl(api, rounded);
    const [acme] = await api.listProjects();
    expect(acme?.rate).toBe(146.67);
  });
});

describe('importToggl, against a database that already holds Records', () => {
  it('imports an entry again for a second Workspace, Project or not', async () => {
    await importToggl(api, entries);
    const summary = await importToggl(api, entries, { workspaceName: 'Toggl' });
    expect(summary).toMatchObject({ records: 4 });
  });

  it('restores a Context whose Project has since been Archived, keeping the Workspace', async () => {
    await importToggl(api, entries);
    const [acme] = await api.listProjects();
    await api.setContext({ workspaceId: fallback.id, projectId: acme!.id });
    await api.archiveProject({ id: acme!.id });

    await importToggl(api, entries, { workspaceName: 'Toggl' });

    expect(await api.getContext()).toEqual({ workspaceId: fallback.id, projectId: null });
  });
});
