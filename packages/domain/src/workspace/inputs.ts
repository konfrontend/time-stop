import { z } from 'zod';
import { colorSchema, idSchema, nameSchema } from '../schema.js';

export const workspaceInputSchema = z.object({
  name: nameSchema,
  currency: z
    .string()
    .trim()
    .max(20)
    .transform((s) => s || null)
    .nullable(),
  color: colorSchema,
});
export type WorkspaceInput = z.infer<typeof workspaceInputSchema>;
export const updateWorkspaceInputSchema = workspaceInputSchema.extend({ id: idSchema });
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceInputSchema>;
