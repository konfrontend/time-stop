import type { DashboardRow } from '../dashboard/DashboardView.js';
import type { Rounding } from '../dashboard/Rounding.js';

export interface ReportRow extends Pick<
  DashboardRow,
  'record' | 'project' | 'client' | 'currency'
> {
  // Name of the Record's Workspace; the last filename fallback before `all`.
  workspace: string | null;
}

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
