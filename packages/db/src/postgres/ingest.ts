import { and, eq, max } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { materializeChange } from '@app/domain';
import type { EntityKind, EntityStore, PushedChange } from '@app/domain';
import type { PostgresDb, PostgresTx } from './open.js';
import { changes, clients, projects, records, workspaces } from './schema.js';
import { bindToken } from './tokens.js';

/** Materialized entity rows by kind; the Postgres schema only, per ADR-0001's one schema per dialect. */
type EntityTable = PgTable & { id: PgColumn };
const tables: Record<EntityKind, EntityTable> = {
  workspace: workspaces,
  client: clients,
  project: projects,
  record: records,
};

function storeOver(tx: PostgresTx): EntityStore {
  return {
    async latestUpdatedAt(entityKind, entityId) {
      const [row] = await tx
        .select({ latest: max(changes.updatedAt) })
        .from(changes)
        .where(and(eq(changes.entityKind, entityKind), eq(changes.entityId, entityId)));
      return row?.latest ?? null;
    },
    async upsert(entityKind, entity) {
      const table: EntityTable = tables[entityKind];
      await tx.insert(table).values(entity).onConflictDoUpdate({ target: table.id, set: entity });
    },
    async remove(entityKind, entityId) {
      const table = tables[entityKind];
      await tx.delete(table).where(eq(table.id, entityId));
    },
  };
}

/**
 * Binds the Token, inserts each Change idempotently on its id and materializes the new ones,
 * all in one transaction, so a failed batch leaves nothing behind.
 */
export async function ingestChanges(
  db: PostgresDb,
  tokenId: string,
  batch: readonly PushedChange[],
): Promise<{ inserted: number }> {
  const { installId, actorId } = batch[0]!;
  return db.transaction(async (tx) => {
    await bindToken(tx, tokenId, { installId, actorId });
    const store = storeOver(tx);
    let inserted = 0;
    for (const change of batch) {
      const rows = await tx.insert(changes).values(change).onConflictDoNothing().returning({
        id: changes.id,
      });
      if (rows.length === 0) continue;
      inserted++;
      await materializeChange(store, change);
    }
    return { inserted };
  });
}
