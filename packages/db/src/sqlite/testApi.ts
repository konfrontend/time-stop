import type { Record, TimeStopApi } from '@time-stop/domain';
import { createSqliteApi } from './api.js';
import { bootstrap, type Identity } from './bootstrap.js';
import { openSqlite, type SqliteDb } from './open.js';
import type { Pusher } from './pusher.js';
import { changes } from './schema.js';

export interface TestApi {
  db: SqliteDb;
  api: TimeStopApi;
  identity: Identity;
  clock: { now: number };
  pusher: Pusher | null;
  changesOf(entityKind: string): Array<{ entityId: string; op: string; payload: unknown }>;
  /** Every Record of the Actor, newest first. */
  allRecords(): Promise<Record[]>;
}

/** A well-formed id that no entity carries. */
export const UNKNOWN_ID = '00000000-0000-7000-8000-000000000000';

export interface TestApiOptions {
  /** Built over the harness's database; `(db, now) => createPusher({ db, now, fetch })`. */
  pusher?: (db: SqliteDb, now: () => number) => Pusher;
}

/** An api over a fresh in-memory database with a settable clock. */
export function testApi(options: TestApiOptions = {}): TestApi {
  const db = openSqlite(':memory:');
  const clock = { now: 10_000 };
  const now = () => clock.now;
  const { seeded: _seeded, ...identity } = bootstrap(db, now);
  const pusher = options.pusher?.(db, now) ?? null;
  const api = createSqliteApi({ db, ...identity, now, ...(pusher ? { pusher } : {}) });
  return {
    db,
    api,
    identity,
    clock,
    pusher,
    changesOf: (entityKind) =>
      db
        .select()
        .from(changes)
        .all()
        .filter((change) => change.entityKind === entityKind)
        .map(({ entityId, op, payload }) => ({ entityId, op, payload })),
    allRecords: () => api.record.list({ from: 0, to: Number.MAX_SAFE_INTEGER }),
  };
}

export const projectInput = {
  clientId: null,
  name: 'Acme API',
  rate: 110,
  limitMin: null,
  limitMax: null,
  limitPeriod: null,
  startDate: null,
  endDate: null,
  color: '#4f6bd9',
} as const;
