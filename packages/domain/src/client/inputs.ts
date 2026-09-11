import { z } from 'zod';
import { idSchema, nameSchema } from '../schema.js';

export const clientInputSchema = z.object({ workspaceId: idSchema, name: nameSchema });
export type ClientInput = z.infer<typeof clientInputSchema>;
export const updateClientInputSchema = z.object({ id: idSchema, name: nameSchema });
export type UpdateClientInput = z.infer<typeof updateClientInputSchema>;

export const listClientsInputSchema = z.object({ workspaceId: idSchema.optional() });
export type ListClientsInput = z.infer<typeof listClientsInputSchema>;
