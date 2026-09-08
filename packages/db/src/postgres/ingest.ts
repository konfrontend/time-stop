import { and, eq, max } from 'drizzle-orm';
import { materializeChange } from '@time-stop/domain';
import type { EntityKind, EntityOf, EntityStore, PushedChange } from '@time-stop/domain';
import type { PostgresDb, PostgresTx } from './open.js';
import { changes, clients, projects, records, workspaces } from './schema.js';
import { bindToken } from './tokens.js';

const tables = { workspace: workspaces, client: clients, project: projects, record: records };

function storeOver(tx: PostgresTx): EntityStore {
  return {
    async latestUpdatedAt(entityKind, entityId) {
      const [row] = await tx
        .select({ latest: max(changes.updatedAt) })
        .from(changes)
        .where(and(eq(changes.entityKind, entityKind), eq(changes.entityId, entityId)));
      return row?.latest ?? null;
    },
    async upsert<K extends EntityKind>(entityKind: K, entity: EntityOf[K]) {
      switch (entityKind) {
        case 'workspace': {
          const row = entity as EntityOf['workspace'];
          await tx
            .insert(workspaces)
            .values(row)
            .onConflictDoUpdate({ target: workspaces.id, set: row });
          break;
        }
        case 'client': {
          const row = entity as EntityOf['client'];
          await tx.insert(clients).values(row).onConflictDoUpdate({ target: clients.id, set: row });
          break;
        }
        case 'project': {
          const row = entity as EntityOf['project'];
          await tx
            .insert(projects)
            .values(row)
            .onConflictDoUpdate({ target: projects.id, set: row });
          break;
        }
        case 'record': {
          const row = entity as EntityOf['record'];
          await tx.insert(records).values(row).onConflictDoUpdate({ target: records.id, set: row });
          break;
        }
      }
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
