import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context, Project, Record, Workspace } from '@time-stop/domain';
import { createSqliteApi } from './api.js';
import { createPusher } from './sync/pusher.js';
import { stopAbandonedTimer } from './record/rows.js';
import { projectInput, testApi, UNKNOWN_ID, type TestApi } from './testApi.js';

let t: TestApi;

beforeEach(() => {
  t = testApi();
});

describe('record.startTimer', () => {
  it('creates a Record with no stop in the default Workspace, owned by the Actor', async () => {
    const timer = await t.api.record.startTimer();

    expect(timer).toMatchObject({
      actorId: t.identity.actorId,
      projectId: null,
      name: '',
      start: '1970-01-01T00:00:10.000Z',
      stop: null,
      updatedAt: '1970-01-01T00:00:10.000Z',
    });
    expect(await t.allRecords()).toEqual([timer]);
  });

  it('appends one create Change with the whole Record as payload', async () => {
    const timer = await t.api.record.startTimer();

    expect(t.changesOf('record')).toEqual([{ entityId: timer.id, op: 'create', payload: timer }]);
  });

  it('stops the running Timer at the new one’s start', async () => {
    const first = await t.api.record.startTimer();
    t.clock.now = 20_000;
    const second = await t.api.record.startTimer();

    const rows = await t.allRecords();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === first.id)).toMatchObject({
      stop: '1970-01-01T00:00:20.000Z',
      updatedAt: '1970-01-01T00:00:20.000Z',
    });
    expect(second).toMatchObject({ start: '1970-01-01T00:00:20.000Z', stop: null });
    expect(await t.api.record.getTimer()).toEqual(second);
    expect(t.changesOf('record').map((c) => [c.entityId, c.op])).toEqual([
      [first.id, 'create'],
      [first.id, 'update'],
      [second.id, 'create'],
    ]);
  });
});

describe('record.stopTimer', () => {
  it('sets stop on the running Timer and appends an update Change', async () => {
    const timer = await t.api.record.startTimer();
    t.clock.now = 15_000;
    const stopped = await t.api.record.stopTimer();

    expect(stopped).toEqual({
      ...timer,
      stop: '1970-01-01T00:00:15.000Z',
      updatedAt: '1970-01-01T00:00:15.000Z',
    });
    expect(await t.api.record.getTimer()).toBeNull();
    expect(t.changesOf('record').at(-1)).toMatchObject({ op: 'update', payload: stopped });
  });

  it('is a no-op without a Timer', async () => {
    expect(await t.api.record.stopTimer()).toBeNull();
    expect(t.changesOf('record')).toEqual([]);
  });
});

describe('record.getTimer', () => {
  it('survives reopening the api over the same database', async () => {
    const timer = await t.api.record.startTimer();
    const reopened = createSqliteApi({ db: t.db, ...t.identity, now: () => t.clock.now });
    expect(await reopened.record.getTimer()).toEqual(timer);
  });
});

describe('record.updateName', () => {
  it('names a running Timer', async () => {
    const timer = await t.api.record.startTimer();
    t.clock.now = 11_000;
    const named = await t.api.record.updateName({ id: timer.id, name: 'Redesign' });

    expect(named).toEqual({ ...timer, name: 'Redesign', updatedAt: '1970-01-01T00:00:11.000Z' });
    expect(await t.api.record.getTimer()).toEqual(named);
    expect(t.changesOf('record').at(-1)).toMatchObject({ op: 'update', payload: named });
  });

  it('names a stopped Record', async () => {
    const timer = await t.api.record.startTimer();
    await t.api.record.stopTimer();
    const named = await t.api.record.updateName({ id: timer.id, name: 'Later' });
    expect(await t.allRecords()).toEqual([named]);
  });

  it('rejects an unknown Record', async () => {
    await expect(t.api.record.updateName({ id: UNKNOWN_ID, name: 'x' })).rejects.toThrow(
      /not found/,
    );
  });
});

describe('record.list', () => {
  it('returns the Actor’s Records started in the range, newest first', async () => {
    await t.api.record.startTimer();
    t.clock.now = 20_000;
    const second = await t.api.record.startTimer();
    t.clock.now = 30_000;
    const third = await t.api.record.startTimer();

    expect(
      await t.api.record.list({ from: '1970-01-01T00:00:20.000Z', to: '1970-01-01T00:00:30.000Z' }),
    ).toEqual([
      { ...second, stop: '1970-01-01T00:00:30.000Z', updatedAt: '1970-01-01T00:00:30.000Z' },
    ]);
    const all = { from: '1970-01-01T00:00:00.000Z', to: '1970-01-01T00:00:40.000Z' };
    expect(await t.api.record.list(all)).toHaveLength(3);
    expect((await t.api.record.list(all))[0]).toEqual(third);
  });
});

/** The default Workspace, a second one, and a Project in the default. */
async function seed(): Promise<{ work: Workspace; personal: Workspace; acme: Project }> {
  const [work] = (await t.api.workspace.list()) as [Workspace];
  const personal = await t.api.workspace.create({ name: 'Personal', currency: null });
  const acme = await t.api.project.create({ ...projectInput, workspaceId: work.id });
  return { work, personal, acme };
}

describe('record.onTimerChanged', () => {
  let work: Workspace;
  let personal: Workspace;
  let acme: Project;
  let fired: Array<Record | null>;

  beforeEach(async () => {
    ({ work, personal, acme } = await seed());
    fired = [];
    t.api.record.onTimerChanged((timer) => fired.push(timer));
  });

  it('fires once for start, Name edit and stop; not after unsubscribing', async () => {
    const listener = vi.fn();
    const unsubscribe = t.api.record.onTimerChanged(listener);

    const timer = await t.api.record.startTimer();
    const named = await t.api.record.updateName({ id: timer.id, name: 'n' });
    await t.api.record.stopTimer();
    unsubscribe();
    await t.api.record.startTimer();

    expect(listener.mock.calls).toEqual([[timer], [named], [null]]);
  });

  it('fires once when deleting the Timer’s Project detaches it', async () => {
    await t.api.context.set({ workspaceId: work.id, projectId: acme.id });
    const timer = await t.api.record.startTimer();
    fired = [];
    t.clock.now = 11_000;
    await t.api.project.delete({ id: acme.id });

    expect(fired).toEqual([{ ...timer, projectId: null, updatedAt: '1970-01-01T00:00:11.000Z' }]);
  });

  it('fires once with null when deleting the Timer’s Workspace', async () => {
    await t.api.context.set({ workspaceId: personal.id, projectId: null });
    await t.api.record.startTimer();
    fired = [];
    await t.api.workspace.delete({ id: personal.id });

    expect(fired).toEqual([null]);
  });

  it('fires once when a Record edit changes the Timer or closes it', async () => {
    const timer = await t.api.record.startTimer();
    fired = [];
    const edited = await t.api.record.update({ ...timer, name: 'Edited' });
    await t.api.record.update({ ...timer, stop: '1970-01-01T00:00:13.000Z' });

    expect(fired).toEqual([edited, null]);
  });

  it('fires once with null when the Timer is deleted', async () => {
    const timer = await t.api.record.startTimer();
    fired = [];
    await t.api.record.delete({ id: timer.id });

    expect(fired).toEqual([null]);
  });

  it('stays silent for writes that leave the Timer as it is', async () => {
    const timer = await t.api.record.startTimer();
    const stopped = await t.api.record.create({
      workspaceId: work.id,
      projectId: null,
      name: '',
      start: '1970-01-01T00:00:01.000Z',
      stop: '1970-01-01T00:00:02.000Z',
    });
    fired = [];

    await t.api.record.updateName({ id: stopped.id, name: 'Later' });
    await t.api.record.update({ ...stopped, name: 'Edited' });
    await t.api.record.delete({ id: stopped.id });
    await t.api.context.set({ workspaceId: personal.id, projectId: null });
    await t.api.client.create({ workspaceId: work.id, name: 'Client' });
    await t.api.project.delete({ id: acme.id });
    await t.api.workspace.delete({ id: personal.id });

    expect(fired).toEqual([]);
    expect(await t.api.record.getTimer()).toEqual(timer);
  });
});

describe('context.onContextChanged', () => {
  let work: Workspace;
  let personal: Workspace;
  let acme: Project;
  let fired: Context[];

  beforeEach(async () => {
    ({ work, personal, acme } = await seed());
    fired = [];
    t.api.context.onContextChanged((context) => fired.push(context));
  });

  it('fires once per Context move; not after unsubscribing', async () => {
    const listener = vi.fn();
    const unsubscribe = t.api.context.onContextChanged(listener);

    await t.api.context.set({ workspaceId: work.id, projectId: acme.id });
    await t.api.context.set({ workspaceId: personal.id, projectId: null });
    unsubscribe();
    await t.api.context.set({ workspaceId: work.id, projectId: null });

    expect(listener.mock.calls).toEqual([
      [{ workspaceId: work.id, projectId: acme.id }],
      [{ workspaceId: personal.id, projectId: null }],
    ]);
  });

  it('fires once when the Context’s Project is archived or deleted', async () => {
    await t.api.context.set({ workspaceId: work.id, projectId: acme.id });
    fired = [];
    await t.api.project.archive({ id: acme.id });
    expect(fired).toEqual([{ workspaceId: work.id, projectId: null }]);

    await t.api.project.unarchive({ id: acme.id });
    await t.api.context.set({ workspaceId: work.id, projectId: acme.id });
    fired = [];
    await t.api.project.delete({ id: acme.id });
    expect(fired).toEqual([{ workspaceId: work.id, projectId: null }]);
  });

  it('fires once when the Context’s Workspace is deleted', async () => {
    await t.api.context.set({ workspaceId: personal.id, projectId: null });
    fired = [];
    await t.api.workspace.delete({ id: personal.id });

    expect(fired).toEqual([{ workspaceId: work.id, projectId: null }]);
  });

  it('stays silent for writes that leave the Context as it is', async () => {
    await t.api.context.set({ workspaceId: work.id, projectId: acme.id });
    fired = [];

    await t.api.context.set({ workspaceId: work.id, projectId: acme.id });
    await t.api.record.startTimer();
    await t.api.record.stopTimer();
    await t.api.project.update({ ...acme, name: 'Renamed' });
    await t.api.workspace.delete({ id: personal.id });

    expect(fired).toEqual([]);
  });
});

describe('Change appending', () => {
  it('rolls back the entity row when the Change cannot be written', async () => {
    t.db.run('DROP TABLE changes');
    await expect(t.api.record.startTimer()).rejects.toThrow();
    expect(await t.allRecords()).toEqual([]);
  });
});

describe('stopAbandonedTimer', () => {
  it('stops a Timer left over from a previous session at its last updatedAt', async () => {
    const timer = await t.api.record.startTimer();
    t.clock.now = 12_000;
    await t.api.record.updateName({ id: timer.id, name: 'Crash' });
    t.clock.now = 99_000;

    const stopped = stopAbandonedTimer(t.db, t.identity);

    expect(stopped).toMatchObject({
      id: timer.id,
      stop: '1970-01-01T00:00:12.000Z',
      updatedAt: '1970-01-01T00:00:12.000Z',
    });
    expect(await t.api.record.getTimer()).toBeNull();
    expect(t.changesOf('record').at(-1)).toMatchObject({ op: 'update', payload: stopped });
  });

  it('is a no-op without a Timer', () => {
    expect(stopAbandonedTimer(t.db, t.identity)).toBeNull();
  });
});

describe('Server settings', () => {
  it('starts unconfigured and names the database file', async () => {
    expect(await t.api.sync.getServer()).toEqual({
      url: null,
      tokenSet: false,
      databasePath: ':memory:',
    });
    expect(await t.api.sync.getStatus()).toMatchObject({ configured: false, halted: false });
  });

  it('stores the URL and the Token, and reports only that a Token is there', async () => {
    const stored = await t.api.sync.setServer({ url: 'https://mirror.test/', token: 'tst_one' });

    expect(stored).toMatchObject({ url: 'https://mirror.test', tokenSet: true });
    expect(await t.api.sync.getStatus()).toMatchObject({ configured: true });
  });

  it('keeps the stored Token when the Owner edits the URL alone', async () => {
    await t.api.sync.setServer({ url: 'https://mirror.test', token: 'tst_one' });
    const stored = await t.api.sync.setServer({ url: 'https://other.test', token: null });

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
    await refusing.api.sync.setServer({ url: 'https://mirror.test', token: 'tst_bad' });
    await refusing.pusher!.settled();
    expect(await refusing.api.sync.getStatus()).toMatchObject({ halted: true });

    await refusing.api.sync.setServer({ url: 'https://other.test', token: null });
    expect(await refusing.api.sync.getStatus()).toMatchObject({ halted: true });

    await refusing.api.sync.setServer({ url: 'https://other.test', token: 'tst_new' });
    await refusing.pusher!.settled();
    expect(await refusing.api.sync.getStatus()).toMatchObject({ halted: false, pending: 0 });
  });

  it('drops the Token with the URL, which unconfigures the mirror', async () => {
    await t.api.sync.setServer({ url: 'https://mirror.test', token: 'tst_one' });
    const stored = await t.api.sync.setServer({ url: '', token: null });

    expect(stored).toMatchObject({ url: null, tokenSet: false });
    expect(await t.api.sync.getStatus()).toMatchObject({ configured: false });
  });
});
