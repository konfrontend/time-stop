import { method, type } from '../api/contract.js';
import { idInputSchema } from '../schema.js';
import type { Project } from './Project.js';
import { listProjectsInputSchema, projectInputSchema, updateProjectInputSchema } from './inputs.js';

export const project = {
  list: method({ input: listProjectsInputSchema.optional(), output: type<Project[]>() }),
  create: method({ input: projectInputSchema, output: type<Project>() }),
  /**
   * A Rate edit re-prices every Record of the Project, past ones included. A new Workspace moves
   * the Project: its Records follow and re-price under that Workspace's Currency, the Client is
   * dropped, and the Context lets go of the Project.
   */
  update: method({ input: updateProjectInputSchema, output: type<Project>() }),
  archive: method({ input: idInputSchema, output: type<Project>() }),
  unarchive: method({ input: idInputSchema, output: type<Project>() }),
  // Records of the Project keep their Workspace and lose the Project reference.
  delete: method({ input: idInputSchema, output: type<void>() }),
};
