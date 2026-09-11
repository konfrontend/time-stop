import type { EntityKind, EntityOf, Entity } from '../change/Change.js';
import type { PushedChange } from './PushedChange.js';

/**
 * Where materialized entities live. latestUpdatedAt must also see deleted entities (the Change
 * log, not just the entity row), or an older update would resurrect a deleted row. That holds
 * only because an Install stamps a delete newer than the row it removes.
 */
export interface EntityStore {
  latestUpdatedAt(entityKind: EntityKind, entityId: string): Promise<string | null>;
  upsert<K extends EntityKind>(entityKind: K, entity: EntityOf[K]): Promise<void>;
  remove(entityKind: EntityKind, entityId: string): Promise<void>;
}

export type Materialization = 'applied' | 'stale';

/**
 * Whole-entity last-write-wins on updatedAt; a tie applies, so replays are idempotent.
 * The Change must already have passed pushedChangeSchema, which checked the payload's kind.
 */
export async function materializeChange(
  store: EntityStore,
  change: PushedChange,
): Promise<Materialization> {
  const latest = await store.latestUpdatedAt(change.entityKind, change.entityId);
  if (latest !== null && latest > change.updatedAt) return 'stale';
  if (change.op === 'delete') {
    await store.remove(change.entityKind, change.entityId);
  } else {
    await store.upsert(change.entityKind, change.payload as Entity);
  }
  return 'applied';
}
