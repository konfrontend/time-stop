import { z } from 'zod';
import { idSchema, rangeFields, rangeInOrder } from '../schema.js';

/** Range plus the four Dashboard filters; an absent filter means "all". */
export const dashboardFields = {
  ...rangeFields,
  workspaceId: idSchema.optional(),
  projectId: idSchema.optional(),
  clientId: idSchema.optional(),
  billable: z.boolean().optional(),
};

export const dashboardInputSchema = z
  .object(dashboardFields)
  .refine(rangeInOrder, 'from must not exceed to');
export type DashboardInput = z.infer<typeof dashboardInputSchema>;
