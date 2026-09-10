import { eq } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { v7 as uuid } from 'uuid';
import type { Change, EntityKind, EntityOf } from '@time-stop/domain';
import type { Identity } from './bootstrap.js';
import type { SqliteDb } from './open.js';
import { changes, clients, projects, records, workspaces } from './schema.js';

export type Tx = Parameters<Parameters<SqliteDb['transaction']>[0]>[0];

const tables: Record<EntityKind, SQLiteTable & { id: SQLiteColumn }> = {
  workspace: workspaces,
  client: clients,
  project: projects,
  record: records,
};

/**
 * Writes the row and its Change in one call, so every entity write is paired with a Change in
 * the same transaction.
 */
export function upsertEntity<K extends EntityKind>(
  tx: Tx,
  identity: Identity,
  entityKind: K,
  op: 'create' | 'update',
  entity: EntityOf[K],
): EntityOf[K] {
  const table = tables[entityKind];
  if (op === 'create') {
    tx.insert(table).values(entity).run();
  } else {
    tx.update(table).set(entity).where(eq(table.id, entity.id)).run();
  }
  appendChange(tx, identity, { entityKind, op, entity });
  return entity;
}

export function removeEntity(
  tx: Tx,
  identity: Identity,
  entityKind: EntityKind,
  id: string,
  at: number,
): void {
  const table = tables[entityKind];
  tx.delete(table).where(eq(table.id, id)).run();
  appendChange(tx, identity, { entityKind, op: 'delete', entity: { id, updatedAt: at } });
}

function appendChange(
  tx: Tx,
  identity: Identity,
  change: { entityKind: EntityKind; op: Change['op']; entity: { id: string; updatedAt: number } },
): void {
  const row: Change = {
    id: uuid({ msecs: change.entity.updatedAt }),
    entityKind: change.entityKind,
    entityId: change.entity.id,
    op: change.op,
    payload: change.op === 'delete' ? {} : (change.entity as Change['payload']),
    updatedAt: change.entity.updatedAt,
    actorId: identity.actorId,
    installId: identity.installId,
    pushedAt: null,
  };
  tx.insert(changes).values(row).run();
}
