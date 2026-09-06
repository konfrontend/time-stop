import { and, desc, eq, gte, isNull, lt } from 'drizzle-orm';
import { newRecord, uuidv7 } from '@time-stop/domain';
import type { ListRecordsInput, Record, TimeStopApi, TimerListener } from '@time-stop/domain';
import type { Identity } from './bootstrap.js';
import { appendChange } from './changes.js';
import type { SqliteDb } from './open.js';
import { records, workspaces } from './schema.js';

export interface SqliteApiOptions extends Identity {
  db: SqliteDb;
  /** Clock, injectable for tests. */
  now?: () => number;
}

/**
 * `TimeStopApi` over the local SQLite file. Every mutation writes the entity row and appends a
 * Change in the same transaction. The Context is the default Workspace and no Project until
 * pickers arrive.
 */
export function createSqliteApi(options: SqliteApiOptions): TimeStopApi {
  const { db, installId, actorId } = options;
  const now = options.now ?? Date.now;
  const identity: Identity = { installId, actorId };
  const listeners = new Set<TimerListener>();

  function notify(timer: Record | null): void {
    for (const listener of listeners) listener(timer);
  }

  function readTimer(): Record | null {
    return (
      db
        .select()
        .from(records)
        .where(and(eq(records.actorId, actorId), isNull(records.stop)))
        .orderBy(desc(records.start))
        .get() ?? null
    );
  }

  function defaultWorkspaceId(): string {
    const workspace = db.select().from(workspaces).orderBy(workspaces.createdAt).get();
    if (!workspace) throw new Error('No Workspace; the database was not bootstrapped');
    return workspace.id;
  }

  return {
    async startTimer() {
      const record = db.transaction((tx) => {
        const at = now();
        const running = readTimer();
        if (running) {
          const stopped = { ...running, stop: at, updatedAt: at };
          tx.update(records)
            .set({ stop: at, updatedAt: at })
            .where(eq(records.id, running.id))
            .run();
          appendChange(tx, identity, { entityKind: 'record', op: 'update', entity: stopped });
        }
        const record = newRecord({
          id: uuidv7(at),
          actorId,
          workspaceId: defaultWorkspaceId(),
          project: null,
          start: at,
          now: at,
        });
        tx.insert(records).values(record).run();
        appendChange(tx, identity, { entityKind: 'record', op: 'create', entity: record });
        return record;
      });
      notify(record);
      return record;
    },

    async stopTimer() {
      const running = readTimer();
      if (!running) return null;
      const at = now();
      const stopped: Record = { ...running, stop: at, updatedAt: at };
      db.transaction((tx) => {
        tx.update(records).set({ stop: at, updatedAt: at }).where(eq(records.id, running.id)).run();
        appendChange(tx, identity, { entityKind: 'record', op: 'update', entity: stopped });
      });
      notify(null);
      return stopped;
    },

    async getTimer() {
      return readTimer();
    },

    async updateRecordName({ id, name }) {
      const existing = db
        .select()
        .from(records)
        .where(and(eq(records.id, id), eq(records.actorId, actorId)))
        .get();
      if (!existing) throw new Error(`Record ${id} not found`);
      const at = now();
      const updated: Record = { ...existing, name, updatedAt: at };
      db.transaction((tx) => {
        tx.update(records).set({ name, updatedAt: at }).where(eq(records.id, id)).run();
        appendChange(tx, identity, { entityKind: 'record', op: 'update', entity: updated });
      });
      if (updated.stop === null) notify(updated);
      return updated;
    },

    async listRecords({ from, to }: ListRecordsInput) {
      return db
        .select()
        .from(records)
        .where(and(eq(records.actorId, actorId), gte(records.start, from), lt(records.start, to)))
        .orderBy(desc(records.start))
        .all();
    },

    subscribeTimer(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
