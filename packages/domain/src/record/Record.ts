import { z } from 'zod';
import { epochMs, idSchema } from '../schema.js';

export const recordSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  projectId: idSchema.nullable(),
  actorId: idSchema,
  name: z.string(),
  start: epochMs,
  stop: epochMs.nullable(),
  updatedAt: epochMs,
});
export type Record = z.infer<typeof recordSchema>;
