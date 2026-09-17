import type { DashboardRow } from '../dashboard/DashboardView.js';
import type { Rounding } from '../dashboard/Rounding.js';

export type ReportRow = Pick<DashboardRow, 'record' | 'project' | 'client' | 'currency'>;

export interface BuildReportInput {
  rows: readonly ReportRow[];
  // Inclusive.
  from: string;
  // Exclusive; the header and the filename name the day before it.
  to: string;
  rounding: Rounding;
  zone?: string;
}

export interface Report {
  filename: string;
  csv: string;
}
