import { z } from 'zod';
import type { Report, Rounding } from '../report.js';
import { method, type } from './contract.js';
import { dashboardFields } from './dashboard.js';
import { rangeInOrder } from './inputs.js';

export const roundingSchema = z.enum(['none', '15m']) satisfies z.ZodType<Rounding>;

/** The Dashboard view to report on, plus the Rounding chosen at Export. */
export const exportReportInputSchema = z
  .object({ ...dashboardFields, rounding: roundingSchema })
  .refine(rangeInOrder, 'from must not exceed to');
export type ExportReportInput = z.infer<typeof exportReportInputSchema>;

export const report = {
  export: method({ input: exportReportInputSchema, output: type<Report>() }),
};
