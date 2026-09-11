import { event, method, type } from '../api/contract.js';
import { contextSchema, type Context } from './Context.js';

export type ContextListener = (context: Context) => void;

export const context = {
  get: method({ output: type<Context>() }),
  // A Project from another Workspace is dropped rather than kept.
  set: method({ input: contextSchema, output: type<Context>() }),
  // Fires whenever a write moves the Context's Workspace or Project.
  onContextChanged: event<Context>(),
};
