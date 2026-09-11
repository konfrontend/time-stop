import { z } from 'zod';
import { idSchema } from '../entities.js';
import type { DashboardView } from '../dashboard.js';
import { method, type } from './contract.js';
import { rangeFields, rangeInOrder } from './inputs.js';

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

export const dashboard = {
  /**
   * Records started in the Range that pass the filters, with Client, Currency and Limits usage
   * derived, plus totals at the time of the call.
   */
  get: method({ input: dashboardInputSchema, output: type<DashboardView>() }),
};
