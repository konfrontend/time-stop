import { z } from 'zod';
import { idSchema, type Client } from '../entities.js';
import { method, type } from './contract.js';
import { idInputSchema, nameSchema } from './inputs.js';

export const clientInputSchema = z.object({ workspaceId: idSchema, name: nameSchema });
export type ClientInput = z.infer<typeof clientInputSchema>;
export const updateClientInputSchema = z.object({ id: idSchema, name: nameSchema });
export type UpdateClientInput = z.infer<typeof updateClientInputSchema>;

export const listClientsInputSchema = z.object({ workspaceId: idSchema.optional() });
export type ListClientsInput = z.infer<typeof listClientsInputSchema>;

export const client = {
  list: method({ input: listClientsInputSchema.optional(), output: type<Client[]>() }),
  create: method({ input: clientInputSchema, output: type<Client>() }),
  update: method({ input: updateClientInputSchema, output: type<Client>() }),
  // Projects of the Client lose their Client reference.
  delete: method({ input: idInputSchema, output: type<void>() }),
};
