import { method, type } from '../api/contract.js';
import { idInputSchema } from '../schema.js';
import type { Workspace } from './Workspace.js';
import { updateWorkspaceInputSchema, workspaceInputSchema } from './inputs.js';

export const workspace = {
  // Oldest first; the first is the default Workspace.
  list: method({ output: type<Workspace[]>() }),
  create: method({ input: workspaceInputSchema, output: type<Workspace>() }),
  update: method({ input: updateWorkspaceInputSchema, output: type<Workspace>() }),
  // Takes the Workspace's Clients, Projects and Records with it; the default Workspace stays.
  delete: method({ input: idInputSchema, output: type<void>() }),
};
