import { z } from 'zod';
import { dashboardFields } from '../dashboard/inputs.js';
import { roundingSchema } from '../dashboard/Rounding.js';
import { rangeInOrder } from '../schema.js';

/** The Dashboard view to report on, with its Rounding. */
export const exportReportInputSchema = z
  .object({ ...dashboardFields, rounding: roundingSchema })
  .refine(rangeInOrder, 'from must not exceed to');
export type ExportReportInput = z.infer<typeof exportReportInputSchema>;
