import { z } from 'zod';
import { timestampSchema, idSchema } from '../schema.js';

export const workspaceSchema = z.object({
  id: idSchema,
  name: z.string(),
  // Free-form label (USD, EUR, USDT…); absent for Workspaces that track unpaid work only.
  currency: z.string().nullable(),
  color: z.string(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Workspace = z.infer<typeof workspaceSchema>;
