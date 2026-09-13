import { z } from 'zod';
import { idSchema, rangeFields, rangeInOrder } from '../schema.js';

/** Range plus the Dashboard filters; an absent filter means "all". */
export const dashboardFields = {
  ...rangeFields,
  workspaceId: idSchema.optional(),
  // Any of the given Projects; an empty list means "all", like an absent one.
  projectIds: idSchema.array().optional(),
  clientId: idSchema.optional(),
  billable: z.boolean().optional(),
};

export const dashboardInputSchema = z
  .object(dashboardFields)
  .refine(rangeInOrder, 'from must not exceed to');
export type DashboardInput = z.infer<typeof dashboardInputSchema>;
