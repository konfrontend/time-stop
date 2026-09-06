import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Record } from '@time-stop/domain';
import type { Identity } from './bootstrap.js';
import { appendChange, type Tx } from './changes.js';
import type { SqliteDb } from './open.js';
import { records } from './schema.js';

export function readTimer(tx: Tx | SqliteDb, actorId: string): Record | null {
  return (
    tx
      .select()
      .from(records)
      .where(and(eq(records.actorId, actorId), isNull(records.stop)))
      .orderBy(desc(records.start))
      .get() ?? null
  );
}

export function stopRecord(tx: Tx, identity: Identity, running: Record, at: number): Record {
  const stopped: Record = { ...running, stop: at, updatedAt: at };
  tx.update(records).set({ stop: at, updatedAt: at }).where(eq(records.id, running.id)).run();
  appendChange(tx, identity, { entityKind: 'record', op: 'update', entity: stopped });
  return stopped;
}

/**
 * A Timer found on boot outlived its app session (crash, kill). The app stops Timers on quit,
 * so it is closed at the last moment the app is known to have been alive rather than now:
 * under-counting beats logging hours nobody worked.
 */
export function stopAbandonedTimer(db: SqliteDb, identity: Identity): Record | null {
  return db.transaction((tx) => {
    const running = readTimer(tx, identity.actorId);
    return running ? stopRecord(tx, identity, running, running.updatedAt) : null;
  });
}
