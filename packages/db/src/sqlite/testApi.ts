import type { TimeStopApi } from '@time-stop/domain';
import { createSqliteApi } from './api.js';
import { bootstrap, type Identity } from './bootstrap.js';
import { openSqlite, type SqliteDb } from './open.js';
import { changes } from './schema.js';

export interface TestApi {
  db: SqliteDb;
  api: TimeStopApi;
  identity: Identity;
  clock: { now: number };
  changesOf(entityKind: string): Array<{ entityId: string; op: string; payload: unknown }>;
}

/** An api over a fresh in-memory database with a settable clock. */
export function testApi(): TestApi {
  const db = openSqlite(':memory:');
  const clock = { now: 10_000 };
  const now = () => clock.now;
  const { seeded: _seeded, ...identity } = bootstrap(db, now);
  const api = createSqliteApi({ db, ...identity, now });
  return {
    db,
    api,
    identity,
    clock,
    changesOf: (entityKind) =>
      db
        .select()
        .from(changes)
        .all()
        .filter((change) => change.entityKind === entityKind)
        .map(({ entityId, op, payload }) => ({ entityId, op, payload })),
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
