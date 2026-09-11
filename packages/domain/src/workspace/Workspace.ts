import { z } from 'zod';
import { epochMs, idSchema } from '../schema.js';

export const workspaceSchema = z.object({
  id: idSchema,
  name: z.string(),
  // Free-form label (USD, EUR, USDT…); absent for Workspaces that track unpaid work only.
  currency: z.string().nullable(),
  createdAt: epochMs,
  updatedAt: epochMs,
});
export type Workspace = z.infer<typeof workspaceSchema>;
