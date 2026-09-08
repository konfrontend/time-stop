import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeStopApi } from '@time-stop/domain';
import { createSqliteApi } from './api.js';
import { createPusher } from './pusher.js';
import { stopAbandonedTimer } from './timer.js';
import { bootstrap } from './bootstrap.js';
import { openSqlite, type SqliteDb } from './open.js';
import { changes, records } from './schema.js';

let db: SqliteDb;
let api: TimeStopApi;
let clock: number;
let actorId: string;
let installId: string;
let role: 'owner';

function recordChanges() {
  return db
    .select()
    .from(changes)
    .all()
    .filter((change) => change.entityKind === 'record');
}

beforeEach(() => {
  db = openSqlite(':memory:');
  clock = 10_000;
  ({ actorId, installId, role } = bootstrap(db, () => clock));
  api = createSqliteApi({
    db,
    actorId,
    installId,
    role,
    now: () => clock,
    // Tests never reach a Server; the pusher stays inert behind a transport that always agrees.
    pusher: createPusher({ db, now: () => clock, fetch: async () => new Response('{}') }),
  });
});

describe('startTimer', () => {
  it('creates a Record with no stop in the default Workspace, owned by the Actor', async () => {
    const timer = await api.startTimer();

    expect(timer).toMatchObject({
      actorId,
      projectId: null,
      name: '',
      start: 10_000,
      stop: null,
      rate: null,
      billable: false,
      updatedAt: 10_000,
    });
    expect(db.select().from(records).all()).toEqual([timer]);
  });

  it('appends one create Change with the whole Record as payload', async () => {
    const timer = await api.startTimer();

    expect(recordChanges()).toEqual([
      expect.objectContaining({
        entityId: timer.id,
        op: 'create',
        payload: timer,
        updatedAt: 10_000,
        actorId,
        installId,
        pushedAt: null,
      }),
    ]);
  });

  it('stops the running Timer at the new one’s start', async () => {
    const first = await api.startTimer();
    clock = 20_000;
    const second = await api.startTimer();

    const rows = db.select().from(records).all();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === first.id)).toMatchObject({ stop: 20_000, updatedAt: 20_000 });
    expect(second).toMatchObject({ start: 20_000, stop: null });
    expect(await api.getTimer()).toEqual(second);
    expect(recordChanges().map((c) => [c.entityId, c.op])).toEqual([
      [first.id, 'create'],
      [first.id, 'update'],
      [second.id, 'create'],
    ]);
  });
});

describe('stopTimer', () => {
  it('sets stop on the running Timer and appends an update Change', async () => {
    const timer = await api.startTimer();
    clock = 15_000;
    const stopped = await api.stopTimer();

    expect(stopped).toEqual({ ...timer, stop: 15_000, updatedAt: 15_000 });
    expect(await api.getTimer()).toBeNull();
    expect(recordChanges().at(-1)).toMatchObject({ op: 'update', payload: stopped });
  });

  it('is a no-op without a Timer', async () => {
    expect(await api.stopTimer()).toBeNull();
    expect(recordChanges()).toEqual([]);
  });
});

describe('getTimer', () => {
  it('survives reopening the api over the same database', async () => {
    const timer = await api.startTimer();
    const reopened = createSqliteApi({ db, actorId, installId, role, now: () => clock });
    expect(await reopened.getTimer()).toEqual(timer);
  });
});

describe('updateRecordName', () => {
  it('names a running Timer', async () => {
    const timer = await api.startTimer();
    clock = 11_000;
    const named = await api.updateRecordName({ id: timer.id, name: 'Redesign' });

    expect(named).toEqual({ ...timer, name: 'Redesign', updatedAt: 11_000 });
    expect(await api.getTimer()).toEqual(named);
    expect(recordChanges().at(-1)).toMatchObject({ op: 'update', payload: named });
  });

  it('names a stopped Record', async () => {
    const timer = await api.startTimer();
    await api.stopTimer();
    const named = await api.updateRecordName({ id: timer.id, name: 'Later' });
    expect(db.select().from(records).all()).toEqual([named]);
  });

  it('rejects an unknown Record', async () => {
    await expect(
      api.updateRecordName({ id: '00000000-0000-7000-8000-000000000000', name: 'x' }),
    ).rejects.toThrow(/not found/);
  });
});

describe('listRecords', () => {
  it('returns the Actor’s Records started in the range, newest first', async () => {
    await api.startTimer();
    clock = 20_000;
    const second = await api.startTimer();
    clock = 30_000;
    const third = await api.startTimer();

    expect(await api.listRecords({ from: 20_000, to: 30_000 })).toEqual([
      { ...second, stop: 30_000, updatedAt: 30_000 },
    ]);
    expect(await api.listRecords({ from: 0, to: 40_000 })).toHaveLength(3);
    expect((await api.listRecords({ from: 0, to: 40_000 }))[0]).toEqual(third);
  });
});

describe('subscribeTimer', () => {
  it('reports the Timer after start, name edit and stop until unsubscribed', async () => {
    const listener = vi.fn();
    const unsubscribe = api.subscribeTimer(listener);

    const timer = await api.startTimer();
    const named = await api.updateRecordName({ id: timer.id, name: 'n' });
    await api.stopTimer();
    unsubscribe();
    await api.startTimer();

    expect(listener.mock.calls).toEqual([[timer], [named], [null]]);
  });
});

describe('Change appending', () => {
  it('rolls back the entity row when the Change cannot be written', async () => {
    db.run('DROP TABLE changes');
    await expect(api.startTimer()).rejects.toThrow();
    expect(db.select().from(records).all()).toEqual([]);
  });
});

describe('stopAbandonedTimer', () => {
  it('stops a Timer left over from a previous session at its last updatedAt', async () => {
    const timer = await api.startTimer();
    clock = 12_000;
    await api.updateRecordName({ id: timer.id, name: 'Crash' });
    clock = 99_000;

    const stopped = stopAbandonedTimer(db, { actorId, installId, role });

    expect(stopped).toMatchObject({ id: timer.id, stop: 12_000, updatedAt: 12_000 });
    expect(await api.getTimer()).toBeNull();
    expect(recordChanges().at(-1)).toMatchObject({ op: 'update', payload: stopped });
  });

  it('is a no-op without a Timer', () => {
    expect(stopAbandonedTimer(db, { actorId, installId, role })).toBeNull();
  });
});

describe('Server settings', () => {
  it('starts unconfigured and names the database file', async () => {
    expect(await api.getServer()).toEqual({ url: null, tokenSet: false, databasePath: ':memory:' });
    expect(await api.getSyncStatus()).toMatchObject({ configured: false, halted: false });
  });

  it('stores the URL and the Token, and reports only that a Token is there', async () => {
    const stored = await api.setServer({ url: 'https://mirror.test/', token: 'tst_one' });

    expect(stored).toMatchObject({ url: 'https://mirror.test', tokenSet: true });
    expect(await api.getSyncStatus()).toMatchObject({ configured: true });
  });

  it('keeps the stored Token when the Owner edits the URL alone', async () => {
    await api.setServer({ url: 'https://mirror.test', token: 'tst_one' });
    const stored = await api.setServer({ url: 'https://other.test', token: null });

    expect(stored).toEqual({
      url: 'https://other.test',
      tokenSet: true,
      databasePath: ':memory:',
    });
  });

  it('leaves a halt standing when the URL alone changes', async () => {
    const pusher = createPusher({
      db,
      now: () => clock,
      fetch: async (_input, init) =>
        new Headers(init?.headers).get('authorization') === 'Bearer tst_bad'
          ? new Response('{}', { status: 401 })
          : new Response('{}'),
    });
    api = createSqliteApi({ db, actorId, installId, role, now: () => clock, pusher });
    await api.setServer({ url: 'https://mirror.test', token: 'tst_bad' });
    await pusher.settled();
    expect(await api.getSyncStatus()).toMatchObject({ halted: true });

    await api.setServer({ url: 'https://other.test', token: null });
    expect(await api.getSyncStatus()).toMatchObject({ halted: true });

    await api.setServer({ url: 'https://other.test', token: 'tst_new' });
    await pusher.settled();
    expect(await api.getSyncStatus()).toMatchObject({ halted: false, pending: 0 });
  });

  it('drops the Token with the URL, which unconfigures the mirror', async () => {
    await api.setServer({ url: 'https://mirror.test', token: 'tst_one' });
    const stored = await api.setServer({ url: '', token: null });

    expect(stored).toMatchObject({ url: null, tokenSet: false });
    expect(await api.getSyncStatus()).toMatchObject({ configured: false });
  });
});
