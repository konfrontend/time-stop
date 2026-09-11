import { method, type } from '../api/contract.js';
import type { Report } from './Report.js';
import { exportReportInputSchema } from './inputs.js';

export const report = {
  export: method({ input: exportReportInputSchema, output: type<Report>() }),
};
