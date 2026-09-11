import { z } from 'zod';
import { idSchema, type Workspace } from '../entities.js';
import { method, type } from './contract.js';
import { idInputSchema, nameSchema } from './inputs.js';

export const workspaceInputSchema = z.object({
  name: nameSchema,
  currency: z
    .string()
    .trim()
    .max(20)
    .transform((s) => s || null)
    .nullable(),
});
export type WorkspaceInput = z.infer<typeof workspaceInputSchema>;
export const updateWorkspaceInputSchema = workspaceInputSchema.extend({ id: idSchema });
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceInputSchema>;

export const workspace = {
  // Oldest first; the first is the default Workspace.
  list: method({ output: type<Workspace[]>() }),
  create: method({ input: workspaceInputSchema, output: type<Workspace>() }),
  update: method({ input: updateWorkspaceInputSchema, output: type<Workspace>() }),
  // Takes the Workspace's Clients, Projects and Records with it; the default Workspace stays.
  delete: method({ input: idInputSchema, output: type<void>() }),
};
