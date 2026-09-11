import { z } from 'zod';
import { idSchema, limitPeriodSchema, type Project } from '../entities.js';
import { method, type } from './contract.js';
import { idInputSchema, nameSchema } from './inputs.js';

const projectFields = {
  clientId: idSchema.nullable(),
  name: nameSchema,
  rate: z.number().nonnegative().nullable(),
  limitMin: z.number().nonnegative().nullable(),
  limitMax: z.number().nonnegative().nullable(),
  limitPeriod: limitPeriodSchema.nullable(),
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color is a hex value like #4f6bd9'),
};

export function checkProject(
  project: {
    limitMin: number | null;
    limitMax: number | null;
    limitPeriod: 'week' | 'month' | null;
    startDate: string | null;
    endDate: string | null;
  },
  ctx: z.RefinementCtx,
): void {
  const hasLimit = project.limitMin !== null || project.limitMax !== null;
  if (hasLimit && project.limitPeriod === null) {
    ctx.addIssue({ code: 'custom', path: ['limitPeriod'], message: 'Limits need a Period' });
  }
  if (
    project.limitMin !== null &&
    project.limitMax !== null &&
    project.limitMin > project.limitMax
  ) {
    ctx.addIssue({ code: 'custom', path: ['limitMax'], message: 'Max must not be below Min' });
  }
  if (project.startDate && project.endDate && project.startDate > project.endDate) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End must not precede start' });
  }
}

export const projectInputSchema = z
  .object({ workspaceId: idSchema, ...projectFields })
  .superRefine(checkProject);
export type ProjectInput = z.infer<typeof projectInputSchema>;
export const updateProjectInputSchema = z
  .object({ id: idSchema, ...projectFields })
  .superRefine(checkProject);
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;

export const listProjectsInputSchema = z.object({
  workspaceId: idSchema.optional(),
  archived: z.boolean().optional(),
});
export type ListProjectsInput = z.infer<typeof listProjectsInputSchema>;

export const project = {
  list: method({ input: listProjectsInputSchema.optional(), output: type<Project[]>() }),
  create: method({ input: projectInputSchema, output: type<Project>() }),
  // A Rate edit re-prices every Record of the Project, past ones included.
  update: method({ input: updateProjectInputSchema, output: type<Project>() }),
  archive: method({ input: idInputSchema, output: type<Project>() }),
  unarchive: method({ input: idInputSchema, output: type<Project>() }),
  // Records of the Project keep their Workspace and lose the Project reference.
  delete: method({ input: idInputSchema, output: type<void>() }),
};
