import { and, desc, eq, isNull, max, ne } from 'drizzle-orm';
import { v7 as uuid } from 'uuid';
import { newRecord, assignProject } from '@time-stop/domain';
import type { CreateRecordInput, Record, UpdateRecordInput } from '@time-stop/domain';
import type { Identity } from './bootstrap.js';
import { removeEntity, upsertEntity, type Tx } from './changes.js';
import { readContext } from './context.js';
import type { SqliteDb } from './open.js';
import { readProject } from './projects.js';
import { records } from './schema.js';
import { readWorkspace } from './workspaces.js';

export function readRecord(tx: Tx, actorId: string, id: string): Record {
  const record = tx
    .select()
    .from(records)
    .where(and(eq(records.id, id), eq(records.actorId, actorId)))
    .get();
  if (!record) throw new Error(`Record ${id} not found`);
  return record;
}

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

/** The one creation path: the Timer and a manual entry both place and log here. */
export function insertRecord(
  tx: Tx,
  identity: Identity,
  input: Omit<CreateRecordInput, 'stop'> & { stop: number | null },
  at: number,
): Record {
  readWorkspace(tx, input.workspaceId);
  const project = input.projectId ? readProject(tx, input.projectId) : null;
  if (project && project.workspaceId !== input.workspaceId) {
    throw new Error('A Record and its Project must share the same Workspace');
  }
  const record = newRecord({
    id: uuid({ msecs: at }),
    actorId: identity.actorId,
    workspaceId: input.workspaceId,
    project,
    name: input.name,
    start: input.start,
    stop: input.stop,
    now: at,
  });
  return upsertEntity(tx, identity, 'record', 'create', record);
}

/** Stops the running Timer at `at` and starts a new one there, placed in the Context. */
export function startTimer(tx: Tx, identity: Identity, at: number): Record {
  const running = readTimer(tx, identity.actorId);
  if (running) stopTimer(tx, identity, running, at);
  const context = readContext(tx);
  return insertRecord(
    tx,
    identity,
    {
      workspaceId: context.workspaceId,
      projectId: context.projectId,
      name: '',
      start: at,
      stop: null,
    },
    at,
  );
}

export function stopTimer(tx: Tx, identity: Identity, running: Record, at: number): Record {
  return upsertEntity(tx, identity, 'record', 'update', { ...running, stop: at, updatedAt: at });
}

/**
 * A Timer found on boot outlived its app session (crash, kill). The app stops Timers on quit,
 * so it is closed at the last moment the app is known to have been alive rather than now:
 * under-counting beats logging hours nobody worked.
 */
export function stopAbandonedTimer(db: SqliteDb, identity: Identity): Record | null {
  return db.transaction((tx) => {
    const running = readTimer(tx, identity.actorId);
    return running ? stopTimer(tx, identity, running, running.updatedAt) : null;
  });
}

export function renameRecord(
  tx: Tx,
  identity: Identity,
  id: string,
  name: string,
  at: number,
): Record {
  const existing = readRecord(tx, identity.actorId, id);
  return upsertEntity(tx, identity, 'record', 'update', { ...existing, name, updatedAt: at });
}

export function updateRecord(
  tx: Tx,
  identity: Identity,
  input: UpdateRecordInput,
  at: number,
): Record {
  const existing = readRecord(tx, identity.actorId, input.id);
  if (input.stop === null && existing.stop !== null) {
    throw new Error('A Record cannot be edited into a second running Timer');
  }
  const placed =
    input.projectId === existing.projectId
      ? existing
      : assignProject(existing, input.projectId ? readProject(tx, input.projectId) : null);
  return upsertEntity(tx, identity, 'record', 'update', {
    ...existing,
    ...placed,
    name: input.name,
    start: input.start,
    stop: input.stop,
    updatedAt: at,
  });
}

export function removeRecord(tx: Tx, identity: Identity, id: string, at: number): Record {
  const existing = readRecord(tx, identity.actorId, id);
  removeEntity(tx, identity, 'record', id, at);
  return existing;
}

export function listRecentNames(
  db: SqliteDb | Tx,
  actorId: string,
  projectId: string | null,
  limit: number,
): string[] {
  const latest = max(records.start);
  return db
    .select({ name: records.name })
    .from(records)
    .where(
      and(
        eq(records.actorId, actorId),
        projectId === null ? isNull(records.projectId) : eq(records.projectId, projectId),
        ne(records.name, ''),
      ),
    )
    .groupBy(records.name)
    .orderBy(desc(latest))
    .limit(limit)
    .all()
    .map((row) => row.name);
}
