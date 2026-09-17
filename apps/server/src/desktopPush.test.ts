import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { mintToken, postgresSchema, type PostgresDb } from '@time-stop/db/postgres';
import {
  createPusher,
  sqliteSchema,
  testApi,
  type Pusher,
  type SqliteDb,
} from '@time-stop/db/testing';
import type { TimeStopApi } from '@time-stop/domain';
import { createApp } from './app.js';
import { testDb } from './testDb.js';

const SERVER_URL = 'http://mirror.test';

let db: PostgresDb;
let app: Hono;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await testDb());
  app = createApp(db);
});
afterAll(() => close());

/** A whole Install: its own SQLite database, pushing over the real Hono app. */
function install(): { api: TimeStopApi; sqlite: SqliteDb; pusher: Pusher } {
  const {
    api,
    db: sqlite,
    pusher,
  } = testApi({
    pusher: (db, now) =>
      createPusher({
        db,
        now,
        wait: async () => {},
        fetch: (input, init) => app.request(String(input), init as RequestInit),
      }),
  });
  return { api, sqlite, pusher: pusher! };
}

const unsent = (sqlite: SqliteDb) =>
  sqlite
    .select()
    .from(sqliteSchema.changes)
    .all()
    .filter((change) => change.pushedAt === null);

describe('the desktop pusher against the Server', () => {
  it('mirrors what the desktop app records, and replaying it changes nothing', async () => {
    const { api, sqlite, pusher } = install();
    const { token } = await mintToken(db);
    await api.sync.setServer({ url: SERVER_URL, token });

    const workspace = await api.workspace.create({
      name: 'Consulting',
      currency: 'EUR',
      color: '#4f6bd9',
    });
    const project = await api.project.create({
      workspaceId: workspace.id,
      clientId: null,
      name: 'Acme API',
      rate: 110,
      limitMin: null,
      limitMax: null,
      limitPeriod: null,
      startDate: null,
      endDate: null,
      color: '#4f6bd9',
    });
    await api.context.set({ workspaceId: workspace.id, projectId: project.id });
    const timer = await api.record.startTimer();
    await api.record.stopTimer();
    await pusher.settled();

    expect(unsent(sqlite)).toEqual([]);
    expect(pusher.status()).toMatchObject({ configured: true, pending: 0, halted: false });

    const mirrored = await db.query.workspaces.findFirst({
      where: eq(postgresSchema.workspaces.id, workspace.id),
    });
    expect(mirrored).toMatchObject({ name: 'Consulting', currency: 'EUR' });
    const record = await db.query.records.findFirst({
      where: eq(postgresSchema.records.id, timer.id),
    });
    expect(record).toMatchObject({ projectId: project.id, stop: expect.any(String) });

    // A delete travels as its own Change and takes the mirrored row with it.
    await api.project.delete({ id: project.id });
    await pusher.settled();
    expect(
      await db.query.projects.findFirst({ where: eq(postgresSchema.projects.id, project.id) }),
    ).toBeUndefined();

    const stored = await db.select().from(postgresSchema.changes);
    sqlite.update(sqliteSchema.changes).set({ pushedAt: null }).run();
    pusher.kick();
    await pusher.settled();
    expect(await db.select().from(postgresSchema.changes)).toHaveLength(stored.length);
  });

  it('halts on a Token the Server refuses, then drains once the Owner replaces it', async () => {
    const { api, sqlite, pusher } = install();
    await api.sync.setServer({ url: SERVER_URL, token: 'tst_nothing' });
    await api.workspace.create({ name: 'Personal', currency: null, color: '#4f6bd9' });
    await pusher.settled();

    expect(pusher.status()).toMatchObject({ halted: true });
    expect(pusher.status().lastError).toMatchObject({ kind: 'auth' });
    expect(unsent(sqlite).length).toBeGreaterThan(0);

    const { token } = await mintToken(db);
    await api.sync.setServer({ url: SERVER_URL, token });
    await pusher.settled();

    expect(pusher.status()).toMatchObject({ halted: false, pending: 0 });
    expect(unsent(sqlite)).toEqual([]);
  });
});
