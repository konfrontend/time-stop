import { and, desc, eq, isNull, max, ne } from 'drizzle-orm';
import { v7 as uuid } from 'uuid';
import { newRecord, placeInProject } from '@time-stop/domain';
import type { CreateRecordInput, Record, UpdateRecordInput } from '@time-stop/domain';
import type { Identity } from './bootstrap.js';
import { appendChange, type Tx } from './changes.js';
import { readContext } from './context.js';
import type { SqliteDb } from './open.js';
import { readProject } from './projects.js';
import { records } from './schema.js';

export function readRecord(tx: Tx, actorId: string, id: string): Record {
  const record = tx
    .select()
    .from(records)
    .where(and(eq(records.id, id), eq(records.actorId, actorId)))
    .get();
  if (!record) throw new Error(`Record ${id} not found`);
  return record;
}

export function insertRecord(
  tx: Tx,
  identity: Identity,
  input: CreateRecordInput,
  at: number,
): Record {
  const record = newRecord({
    id: uuid({ msecs: at }),
    actorId: identity.actorId,
    workspaceId: readContext(tx).workspaceId,
    project: input.projectId ? readProject(tx, input.projectId) : null,
    name: input.name,
    start: input.start,
    stop: input.stop,
    now: at,
  });
  tx.insert(records).values(record).run();
  appendChange(tx, identity, { entityKind: 'record', op: 'create', entity: record });
  return record;
}

export function patchRecord(
  tx: Tx,
  identity: Identity,
  id: string,
  fields: Partial<Pick<Record, 'name' | 'billable'>>,
  at: number,
): Record {
  const existing = readRecord(tx, identity.actorId, id);
  return writeRecord(tx, identity, { ...existing, ...fields, updatedAt: at });
}

function writeRecord(tx: Tx, identity: Identity, updated: Record): Record {
  const { id, ...fields } = updated;
  tx.update(records).set(fields).where(eq(records.id, id)).run();
  appendChange(tx, identity, { entityKind: 'record', op: 'update', entity: updated });
  return updated;
}

export function updateRecordRow(
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
      : placeInProject(existing, input.projectId ? readProject(tx, input.projectId) : null);
  return writeRecord(tx, identity, {
    ...existing,
    ...placed,
    name: input.name,
    start: input.start,
    stop: input.stop,
    billable: input.billable,
    updatedAt: at,
  });
}

export function deleteRecordRow(tx: Tx, identity: Identity, id: string, at: number): Record {
  const existing = readRecord(tx, identity.actorId, id);
  tx.delete(records).where(eq(records.id, id)).run();
  appendChange(tx, identity, { entityKind: 'record', op: 'delete', entity: { id, updatedAt: at } });
  return existing;
}

export function listRecentNameRows(
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
