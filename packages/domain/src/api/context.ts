import { z } from 'zod';
import { idSchema } from '../entities.js';
import { event, method, type } from './contract.js';

export const contextSchema = z.object({ workspaceId: idSchema, projectId: idSchema.nullable() });
export type Context = z.infer<typeof contextSchema>;

export type ContextListener = (context: Context) => void;

export const context = {
  get: method({ output: type<Context>() }),
  // A Project from another Workspace is dropped rather than kept.
  set: method({ input: contextSchema, output: type<Context>() }),
  // Fires whenever a write moves the Context's Workspace or Project.
  onContextChanged: event<Context>(),
};
