import { z } from 'zod';
import {
  changeSchema,
  clientSchema,
  projectSchema,
  recordSchema,
  workspaceSchema,
} from './entities.js';
import type { Client, EntityKind, Project, Record, Workspace } from './entities.js';

const entitySchemas = {
  workspace: workspaceSchema,
  client: clientSchema,
  project: projectSchema,
  record: recordSchema,
} as const;

export interface EntityOf {
  workspace: Workspace;
  client: Client;
  project: Project;
  record: Record;
}
export type Entity = EntityOf[EntityKind];

const emptyPayload = z.object({}).strict();
type Empty = z.infer<typeof emptyPayload>;

/** A Change as an Install pushes it; pushedAt is the Install's own bookkeeping and stays home. */
export const pushedChangeSchema = changeSchema
  .omit({ pushedAt: true, payload: true })
  .extend({ payload: z.record(z.string(), z.unknown()) })
  .transform((change, ctx) => {
    if (change.op === 'delete') {
      if (!emptyPayload.safeParse(change.payload).success) {
        ctx.addIssue({ code: 'custom', path: ['payload'], message: 'A delete carries no payload' });
      }
      return { ...change, payload: {} as Entity | Empty };
    }
    const parsed = entitySchemas[change.entityKind].safeParse(change.payload);
    if (!parsed.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['payload'],
        message: `Payload is not a ${change.entityKind}`,
      });
      return z.NEVER;
    }
    if (parsed.data.id !== change.entityId) {
      ctx.addIssue({ code: 'custom', path: ['payload', 'id'], message: 'Payload id differs' });
    }
    if (parsed.data.updatedAt !== change.updatedAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['payload', 'updatedAt'],
        message: 'Payload updatedAt differs',
      });
    }
    return { ...change, payload: parsed.data as Entity | Empty };
  });
export type PushedChange = z.infer<typeof pushedChangeSchema>;

const MAX_BATCH = 1000;

/** One push comes from one Install and one Actor, the pair the Token gets bound to. */
export const pushChangesRequestSchema = z
  .object({ changes: z.array(pushedChangeSchema).min(1).max(MAX_BATCH) })
  .superRefine(({ changes }, ctx) => {
    const first = changes[0]!;
    const mixed = changes.some(
      (c) => c.installId !== first.installId || c.actorId !== first.actorId,
    );
    if (mixed) {
      ctx.addIssue({
        code: 'custom',
        path: ['changes'],
        message: 'A batch comes from one Install and one Actor',
      });
    }
  });
export type PushChangesRequest = z.infer<typeof pushChangesRequestSchema>;

export const pushChangesResponseSchema = z.object({ inserted: z.int().nonnegative() });
export type PushChangesResponse = z.infer<typeof pushChangesResponseSchema>;

/**
 * Where materialized entities live. latestUpdatedAt must also see deleted entities (the Change
 * log, not just the entity row), or an older update would resurrect a deleted row. That holds
 * only because an Install stamps a delete newer than the row it removes.
 */
export interface EntityStore {
  latestUpdatedAt(entityKind: EntityKind, entityId: string): Promise<number | null>;
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
