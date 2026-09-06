import { and, desc, eq, gte, isNull, lt } from 'drizzle-orm';
import { v7 as uuid } from 'uuid';
import { can, newRecord } from '@time-stop/domain';
import type {
  ListRecordsInput,
  Permission,
  Record,
  TimeStopApi,
  TimerListener,
} from '@time-stop/domain';
import type { Principal } from './bootstrap.js';
import { appendChange, type Tx } from './changes.js';
import type { SqliteDb } from './open.js';
import { records, workspaces } from './schema.js';

export interface SqliteApiOptions extends Principal {
  db: SqliteDb;
  now?: () => number;
}

/** The Context is fixed: default Workspace, no Project. */
export function createSqliteApi(options: SqliteApiOptions): TimeStopApi {
  const { db, installId, actorId, role } = options;
  const now = options.now ?? Date.now;
  const principal: Principal = { installId, actorId, role };
  const listeners = new Set<TimerListener>();

  function require(permission: Permission): void {
    if (!can(role, permission)) throw new Error(`Role ${role} lacks ${permission}`);
  }

  function notify(timer: Record | null): void {
    for (const listener of listeners) listener(timer);
  }

  function readTimer(tx: Tx | SqliteDb): Record | null {
    return (
      tx
        .select()
        .from(records)
        .where(and(eq(records.actorId, actorId), isNull(records.stop)))
        .orderBy(desc(records.start))
        .get() ?? null
    );
  }

  function defaultWorkspaceId(tx: Tx): string {
    const workspace = tx.select().from(workspaces).orderBy(workspaces.createdAt).get();
    if (!workspace) throw new Error('No Workspace; the database was not bootstrapped');
    return workspace.id;
  }

  function stopRecord(tx: Tx, running: Record, at: number): Record {
    const stopped: Record = { ...running, stop: at, updatedAt: at };
    tx.update(records).set({ stop: at, updatedAt: at }).where(eq(records.id, running.id)).run();
    appendChange(tx, principal, { entityKind: 'record', op: 'update', entity: stopped });
    return stopped;
  }

  return {
    async startTimer() {
      require('record:write');
      const record = db.transaction((tx) => {
        const at = now();
        const running = readTimer(tx);
        if (running) stopRecord(tx, running, at);
        const record = newRecord({
          id: uuid({ msecs: at }),
          actorId,
          workspaceId: defaultWorkspaceId(tx),
          project: null,
          start: at,
          now: at,
        });
        tx.insert(records).values(record).run();
        appendChange(tx, principal, { entityKind: 'record', op: 'create', entity: record });
        return record;
      });
      notify(record);
      return record;
    },

    async stopTimer() {
      require('record:write');
      const stopped = db.transaction((tx) => {
        const running = readTimer(tx);
        return running ? stopRecord(tx, running, now()) : null;
      });
      if (stopped) notify(null);
      return stopped;
    },

    async getTimer() {
      require('record:read');
      return readTimer(db);
    },

    async updateRecordName({ id, name }) {
      require('record:write');
      const updated = db.transaction((tx) => {
        const existing = tx
          .select()
          .from(records)
          .where(and(eq(records.id, id), eq(records.actorId, actorId)))
          .get();
        if (!existing) throw new Error(`Record ${id} not found`);
        const at = now();
        const updated: Record = { ...existing, name, updatedAt: at };
        tx.update(records).set({ name, updatedAt: at }).where(eq(records.id, id)).run();
        appendChange(tx, principal, { entityKind: 'record', op: 'update', entity: updated });
        return updated;
      });
      if (updated.stop === null) notify(updated);
      return updated;
    },

    async listRecords({ from, to }: ListRecordsInput) {
      require('record:read');
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
