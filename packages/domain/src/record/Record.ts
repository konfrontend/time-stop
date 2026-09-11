import { z } from 'zod';
import { timestampSchema, idSchema } from '../schema.js';

export const recordSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  projectId: idSchema.nullable(),
  actorId: idSchema,
  name: z.string(),
  start: timestampSchema,
  stop: timestampSchema.nullable(),
  updatedAt: timestampSchema,
});
export type Record = z.infer<typeof recordSchema>;
