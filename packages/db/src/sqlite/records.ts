import { and, eq } from 'drizzle-orm';
import type { Record } from '@time-stop/domain';
import type { Identity } from './bootstrap.js';
import { appendChange, type Tx } from './changes.js';
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

export function patchRecord(
  tx: Tx,
  identity: Identity,
  id: string,
  fields: Partial<Pick<Record, 'name' | 'billable'>>,
  at: number,
): Record {
  const existing = readRecord(tx, identity.actorId, id);
  const updated: Record = { ...existing, ...fields, updatedAt: at };
  tx.update(records)
    .set({ ...fields, updatedAt: at })
    .where(eq(records.id, id))
    .run();
  appendChange(tx, identity, { entityKind: 'record', op: 'update', entity: updated });
  return updated;
}
