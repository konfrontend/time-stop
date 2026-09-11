import { z } from 'zod';
import { dashboardFields } from '../dashboard/inputs.js';
import { rangeInOrder } from '../schema.js';
import type { Rounding } from './Report.js';

export const roundingSchema = z.enum(['none', '15m']) satisfies z.ZodType<Rounding>;

/** The Dashboard view to report on, plus the Rounding chosen at Export. */
export const exportReportInputSchema = z
  .object({ ...dashboardFields, rounding: roundingSchema })
  .refine(rangeInOrder, 'from must not exceed to');
export type ExportReportInput = z.infer<typeof exportReportInputSchema>;
