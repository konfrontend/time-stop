import { z } from 'zod';
import { epochMs, idSchema } from '../schema.js';

export const clientSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  name: z.string(),
  updatedAt: epochMs,
});
export type Client = z.infer<typeof clientSchema>;
