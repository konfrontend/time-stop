import { method, type } from '../api/contract.js';
import { idInputSchema } from '../schema.js';
import type { Client } from './Client.js';
import { clientInputSchema, listClientsInputSchema, updateClientInputSchema } from './inputs.js';

export const client = {
  list: method({ input: listClientsInputSchema.optional(), output: type<Client[]>() }),
  create: method({ input: clientInputSchema, output: type<Client>() }),
  update: method({ input: updateClientInputSchema, output: type<Client>() }),
  // Projects of the Client lose their Client reference.
  delete: method({ input: idInputSchema, output: type<void>() }),
};
