import { uuidv7 } from '@time-stop/domain';
import type { ChangeOp, EntityKind, Change } from '@time-stop/domain';
import type { Identity } from './bootstrap.js';
import type { SqliteDb } from './open.js';
import { changes } from './schema.js';

type Tx = Parameters<Parameters<SqliteDb['transaction']>[0]>[0];

interface Entity {
  id: string;
  updatedAt: number;
}

/**
 * Appends one Change for a mutation. Call inside the transaction that writes the entity row so
 * the two never diverge. The payload is the whole entity after the change; empty on delete.
 */
export function appendChange(
  tx: Tx | SqliteDb,
  identity: Identity,
  change: { entityKind: EntityKind; op: ChangeOp; entity: Entity },
): Change {
  const row: Change = {
    id: uuidv7(change.entity.updatedAt),
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
  return row;
}
