import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context, Project, Record, Workspace } from '@time-stop/domain';
import { createSqliteApi } from './api.js';
import { createPusher } from './pusher.js';
import { stopAbandonedTimer } from './records.js';
import { projectInput, testApi, type TestApi } from './testApi.js';

const UNKNOWN_ID = '00000000-0000-7000-8000-000000000000';

let t: TestApi;

const allRecords = () => t.api.listRecords({ from: 0, to: Number.MAX_SAFE_INTEGER });

beforeEach(() => {
  t = testApi();
});

describe('startTimer', () => {
  it('creates a Record with no stop in the default Workspace, owned by the Actor', async () => {
    const timer = await t.api.startTimer();

    expect(timer).toMatchObject({
      actorId: t.identity.actorId,
      projectId: null,
      name: '',
      start: 10_000,
      stop: null,
      rate: null,
      billable: false,
      updatedAt: 10_000,
    });
    expect(await allRecords()).toEqual([timer]);
  });

  it('appends one create Change with the whole Record as payload', async () => {
    const timer = await t.api.startTimer();

    expect(t.changesOf('record')).toEqual([{ entityId: timer.id, op: 'create', payload: timer }]);
  });

  it('stops the running Timer at the new one’s start', async () => {
    const first = await t.api.startTimer();
    t.clock.now = 20_000;
    const second = await t.api.startTimer();

    const rows = await allRecords();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === first.id)).toMatchObject({ stop: 20_000, updatedAt: 20_000 });
    expect(second).toMatchObject({ start: 20_000, stop: null });
    expect(await t.api.getTimer()).toEqual(second);
    expect(t.changesOf('record').map((c) => [c.entityId, c.op])).toEqual([
      [first.id, 'create'],
      [first.id, 'update'],
      [second.id, 'create'],
    ]);
  });
});

describe('stopTimer', () => {
  it('sets stop on the running Timer and appends an update Change', async () => {
    const timer = await t.api.startTimer();
    t.clock.now = 15_000;
    const stopped = await t.api.stopTimer();

    expect(stopped).toEqual({ ...timer, stop: 15_000, updatedAt: 15_000 });
    expect(await t.api.getTimer()).toBeNull();
    expect(t.changesOf('record').at(-1)).toMatchObject({ op: 'update', payload: stopped });
  });

  it('is a no-op without a Timer', async () => {
    expect(await t.api.stopTimer()).toBeNull();
    expect(t.changesOf('record')).toEqual([]);
  });
});

describe('getTimer', () => {
  it('survives reopening the api over the same database', async () => {
    const timer = await t.api.startTimer();
    const reopened = createSqliteApi({ db: t.db, ...t.identity, now: () => t.clock.now });
    expect(await reopened.getTimer()).toEqual(timer);
  });
});

describe('updateRecordName', () => {
  it('names a running Timer', async () => {
    const timer = await t.api.startTimer();
    t.clock.now = 11_000;
    const named = await t.api.updateRecordName({ id: timer.id, name: 'Redesign' });

    expect(named).toEqual({ ...timer, name: 'Redesign', updatedAt: 11_000 });
    expect(await t.api.getTimer()).toEqual(named);
    expect(t.changesOf('record').at(-1)).toMatchObject({ op: 'update', payload: named });
  });

  it('names a stopped Record', async () => {
    const timer = await t.api.startTimer();
    await t.api.stopTimer();
    const named = await t.api.updateRecordName({ id: timer.id, name: 'Later' });
    expect(await allRecords()).toEqual([named]);
  });

  it('rejects an unknown Record', async () => {
    await expect(t.api.updateRecordName({ id: UNKNOWN_ID, name: 'x' })).rejects.toThrow(
      /not found/,
    );
  });
});

describe('listRecords', () => {
  it('returns the Actor’s Records started in the range, newest first', async () => {
    await t.api.startTimer();
    t.clock.now = 20_000;
    const second = await t.api.startTimer();
    t.clock.now = 30_000;
    const third = await t.api.startTimer();

    expect(await t.api.listRecords({ from: 20_000, to: 30_000 })).toEqual([
      { ...second, stop: 30_000, updatedAt: 30_000 },
    ]);
    expect(await t.api.listRecords({ from: 0, to: 40_000 })).toHaveLength(3);
    expect((await t.api.listRecords({ from: 0, to: 40_000 }))[0]).toEqual(third);
  });
});

/** The default Workspace, a second one, and a Project in the default. */
async function seed(): Promise<{ work: Workspace; personal: Workspace; acme: Project }> {
  const [work] = (await t.api.listWorkspaces()) as [Workspace];
  const personal = await t.api.createWorkspace({ name: 'Personal', currency: null });
  const acme = await t.api.createProject({ ...projectInput, workspaceId: work.id });
  return { work, personal, acme };
}

describe('subscribeTimer', () => {
  let work: Workspace;
  let personal: Workspace;
  let acme: Project;
  let fired: Array<Record | null>;

  beforeEach(async () => {
    ({ work, personal, acme } = await seed());
    fired = [];
    t.api.subscribeTimer((timer) => fired.push(timer));
  });

  it('fires once for start, Name edit, Billable flip and stop; not after unsubscribing', async () => {
    const listener = vi.fn();
    const unsubscribe = t.api.subscribeTimer(listener);

    const timer = await t.api.startTimer();
    const named = await t.api.updateRecordName({ id: timer.id, name: 'n' });
    const billable = await t.api.setRecordBillable({ id: timer.id, billable: true });
    await t.api.stopTimer();
    unsubscribe();
    await t.api.startTimer();

    expect(listener.mock.calls).toEqual([[timer], [named], [billable], [null]]);
  });

  it('fires once when deleting the Timer’s Project detaches it', async () => {
    await t.api.setContext({ workspaceId: work.id, projectId: acme.id });
    const timer = await t.api.startTimer();
    fired = [];
    t.clock.now = 11_000;
    await t.api.deleteProject({ id: acme.id });

    expect(fired).toEqual([{ ...timer, projectId: null, updatedAt: 11_000 }]);
  });

  it('fires once with null when deleting the Timer’s Workspace', async () => {
    await t.api.setContext({ workspaceId: personal.id, projectId: null });
    await t.api.startTimer();
    fired = [];
    await t.api.deleteWorkspace({ id: personal.id });

    expect(fired).toEqual([null]);
  });

  it('fires once when a Record edit changes the Timer or closes it', async () => {
    const timer = await t.api.startTimer();
    fired = [];
    const edited = await t.api.updateRecord({ ...timer, name: 'Edited' });
    await t.api.updateRecord({ ...timer, stop: 13_000 });

    expect(fired).toEqual([edited, null]);
  });

  it('fires once with null when the Timer is deleted', async () => {
    const timer = await t.api.startTimer();
    fired = [];
    await t.api.deleteRecord({ id: timer.id });

    expect(fired).toEqual([null]);
  });

  it('stays silent for writes that leave the Timer as it is', async () => {
    const timer = await t.api.startTimer();
    const stopped = await t.api.createRecord({
      workspaceId: work.id,
      projectId: null,
      name: '',
      start: 1_000,
      stop: 2_000,
    });
    fired = [];

    await t.api.updateRecordName({ id: stopped.id, name: 'Later' });
    await t.api.setRecordBillable({ id: stopped.id, billable: true });
    await t.api.updateRecord({ ...stopped, name: 'Edited' });
    await t.api.deleteRecord({ id: stopped.id });
    await t.api.setContext({ workspaceId: personal.id, projectId: null });
    await t.api.createClient({ workspaceId: work.id, name: 'Client' });
    await t.api.deleteProject({ id: acme.id });
    await t.api.deleteWorkspace({ id: personal.id });

    expect(fired).toEqual([]);
    expect(await t.api.getTimer()).toEqual(timer);
  });
});

describe('subscribeContext', () => {
  let work: Workspace;
  let personal: Workspace;
  let acme: Project;
  let fired: Context[];

  beforeEach(async () => {
    ({ work, personal, acme } = await seed());
    fired = [];
    t.api.subscribeContext((context) => fired.push(context));
  });

  it('fires once per Context move; not after unsubscribing', async () => {
    const listener = vi.fn();
    const unsubscribe = t.api.subscribeContext(listener);

    await t.api.setContext({ workspaceId: work.id, projectId: acme.id });
    await t.api.setContext({ workspaceId: personal.id, projectId: null });
    unsubscribe();
    await t.api.setContext({ workspaceId: work.id, projectId: null });

    expect(listener.mock.calls).toEqual([
      [{ workspaceId: work.id, projectId: acme.id }],
      [{ workspaceId: personal.id, projectId: null }],
    ]);
  });

  it('fires once when the Context’s Project is archived or deleted', async () => {
    await t.api.setContext({ workspaceId: work.id, projectId: acme.id });
    fired = [];
    await t.api.archiveProject({ id: acme.id });
    expect(fired).toEqual([{ workspaceId: work.id, projectId: null }]);

    await t.api.unarchiveProject({ id: acme.id });
    await t.api.setContext({ workspaceId: work.id, projectId: acme.id });
    fired = [];
    await t.api.deleteProject({ id: acme.id });
    expect(fired).toEqual([{ workspaceId: work.id, projectId: null }]);
  });

  it('fires once when the Context’s Workspace is deleted', async () => {
    await t.api.setContext({ workspaceId: personal.id, projectId: null });
    fired = [];
    await t.api.deleteWorkspace({ id: personal.id });

    expect(fired).toEqual([{ workspaceId: work.id, projectId: null }]);
  });

  it('stays silent for writes that leave the Context as it is', async () => {
    await t.api.setContext({ workspaceId: work.id, projectId: acme.id });
    fired = [];

    await t.api.setContext({ workspaceId: work.id, projectId: acme.id });
    await t.api.startTimer();
    await t.api.stopTimer();
    await t.api.updateProject({ ...acme, name: 'Renamed' });
    await t.api.deleteWorkspace({ id: personal.id });

    expect(fired).toEqual([]);
  });
});

describe('Change appending', () => {
  it('rolls back the entity row when the Change cannot be written', async () => {
    t.db.run('DROP TABLE changes');
    await expect(t.api.startTimer()).rejects.toThrow();
    expect(await allRecords()).toEqual([]);
  });
});

describe('stopAbandonedTimer', () => {
  it('stops a Timer left over from a previous session at its last updatedAt', async () => {
    const timer = await t.api.startTimer();
    t.clock.now = 12_000;
    await t.api.updateRecordName({ id: timer.id, name: 'Crash' });
    t.clock.now = 99_000;

    const stopped = stopAbandonedTimer(t.db, t.identity);

    expect(stopped).toMatchObject({ id: timer.id, stop: 12_000, updatedAt: 12_000 });
    expect(await t.api.getTimer()).toBeNull();
    expect(t.changesOf('record').at(-1)).toMatchObject({ op: 'update', payload: stopped });
  });

  it('is a no-op without a Timer', () => {
    expect(stopAbandonedTimer(t.db, t.identity)).toBeNull();
  });
});

describe('Server settings', () => {
  it('starts unconfigured and names the database file', async () => {
    expect(await t.api.getServer()).toEqual({
      url: null,
      tokenSet: false,
      databasePath: ':memory:',
    });
    expect(await t.api.getSyncStatus()).toMatchObject({ configured: false, halted: false });
  });

  it('stores the URL and the Token, and reports only that a Token is there', async () => {
    const stored = await t.api.setServer({ url: 'https://mirror.test/', token: 'tst_one' });

    expect(stored).toMatchObject({ url: 'https://mirror.test', tokenSet: true });
    expect(await t.api.getSyncStatus()).toMatchObject({ configured: true });
  });

  it('keeps the stored Token when the Owner edits the URL alone', async () => {
    await t.api.setServer({ url: 'https://mirror.test', token: 'tst_one' });
    const stored = await t.api.setServer({ url: 'https://other.test', token: null });

    expect(stored).toEqual({
      url: 'https://other.test',
      tokenSet: true,
      databasePath: ':memory:',
    });
  });

  it('leaves a halt standing when the URL alone changes; a new Token resumes', async () => {
    const refusing = testApi({
      pusher: (db, now) =>
        createPusher({
          db,
          now,
          fetch: async (_input, init) =>
            new Headers(init?.headers).get('authorization') === 'Bearer tst_bad'
              ? new Response('{}', { status: 401 })
              : new Response('{}'),
        }),
    });
    await refusing.api.setServer({ url: 'https://mirror.test', token: 'tst_bad' });
    await refusing.pusher!.settled();
    expect(await refusing.api.getSyncStatus()).toMatchObject({ halted: true });

    await refusing.api.setServer({ url: 'https://other.test', token: null });
    expect(await refusing.api.getSyncStatus()).toMatchObject({ halted: true });

    await refusing.api.setServer({ url: 'https://other.test', token: 'tst_new' });
    await refusing.pusher!.settled();
    expect(await refusing.api.getSyncStatus()).toMatchObject({ halted: false, pending: 0 });
  });

  it('drops the Token with the URL, which unconfigures the mirror', async () => {
    await t.api.setServer({ url: 'https://mirror.test', token: 'tst_one' });
    const stored = await t.api.setServer({ url: '', token: null });

    expect(stored).toMatchObject({ url: null, tokenSet: false });
    expect(await t.api.getSyncStatus()).toMatchObject({ configured: false });
  });
});
