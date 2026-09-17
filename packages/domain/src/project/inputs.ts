import { z } from 'zod';
import { colorSchema, idSchema, nameSchema } from '../schema.js';
import { limitPeriodSchema } from './Project.js';
import { validateProject } from './rules.js';

const projectFields = {
  clientId: idSchema.nullable(),
  name: nameSchema,
  rate: z.number().nonnegative().nullable(),
  limitMin: z.number().nonnegative().nullable(),
  limitMax: z.number().nonnegative().nullable(),
  limitPeriod: limitPeriodSchema.nullable(),
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  color: colorSchema,
};

export const projectInputSchema = z
  .object({ workspaceId: idSchema, ...projectFields })
  .superRefine(validateProject);
export type ProjectInput = z.infer<typeof projectInputSchema>;
export const updateProjectInputSchema = z
  .object({ id: idSchema, workspaceId: idSchema, ...projectFields })
  .superRefine(validateProject);
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;

export const listProjectsInputSchema = z.object({
  workspaceId: idSchema.optional(),
  archived: z.boolean().optional(),
});
export type ListProjectsInput = z.infer<typeof listProjectsInputSchema>;
