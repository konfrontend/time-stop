import { z } from 'zod';
import { idSchema } from '../schema.js';

export const contextSchema = z.object({ workspaceId: idSchema, projectId: idSchema.nullable() });
export type Context = z.infer<typeof contextSchema>;
