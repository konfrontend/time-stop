import { z } from 'zod';
import { timestampSchema, idSchema } from '../schema.js';

export const clientSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  name: z.string(),
  updatedAt: timestampSchema,
});
export type Client = z.infer<typeof clientSchema>;
