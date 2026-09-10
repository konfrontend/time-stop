import { z } from 'zod';
import type { Period } from './time.js';

export const idSchema = z.uuidv7();
const id = idSchema;
export const epochMs = z.int().nonnegative();

export const workspaceSchema = z.object({
  id,
  name: z.string(),
  // Free-form label (USD, EUR, USDT…); absent for Workspaces that track unpaid work only.
  currency: z.string().nullable(),
  createdAt: epochMs,
  updatedAt: epochMs,
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const clientSchema = z.object({
  id,
  workspaceId: id,
  name: z.string(),
  updatedAt: epochMs,
});
export type Client = z.infer<typeof clientSchema>;

export const limitPeriodSchema = z.enum(['week', 'month']) satisfies z.ZodType<Period>;
export type LimitPeriod = Period;

export const projectSchema = z.object({
  id,
  workspaceId: id,
  clientId: id.nullable(),
  name: z.string(),
  rate: z.number().nonnegative().nullable(),
  limitMin: z.number().nonnegative().nullable(),
  limitMax: z.number().nonnegative().nullable(),
  limitPeriod: limitPeriodSchema.nullable(),
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  color: z.string(),
  archived: z.boolean(),
  updatedAt: epochMs,
});
export type Project = z.infer<typeof projectSchema>;

export const recordSchema = z.object({
  id,
  workspaceId: id,
  projectId: id.nullable(),
  actorId: id,
  name: z.string(),
  start: epochMs,
  stop: epochMs.nullable(),
  updatedAt: epochMs,
});
export type Record = z.infer<typeof recordSchema>;

export const entityKindSchema = z.enum(['workspace', 'client', 'project', 'record']);
export type EntityKind = z.infer<typeof entityKindSchema>;

export const changeOpSchema = z.enum(['create', 'update', 'delete']);
export type ChangeOp = z.infer<typeof changeOpSchema>;

export const changePayloadSchema = z.union([
  workspaceSchema,
  clientSchema,
  projectSchema,
  recordSchema,
  z.object({}).strict(),
]);

/** Payload is the whole entity after the change; empty on delete. */
export const changeSchema = z.object({
  id,
  entityKind: entityKindSchema,
  entityId: id,
  op: changeOpSchema,
  payload: changePayloadSchema,
  updatedAt: epochMs,
  actorId: id,
  installId: id,
  pushedAt: epochMs.nullable(),
});
export type Change = z.infer<typeof changeSchema>;
