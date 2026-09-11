import type { Client } from '../client/Client.js';
import type { LimitPeriod, Project } from '../project/Project.js';
import type { Record } from '../record/Record.js';

/** Hours of the Project's Records in the calendar Period holding the row, against its Limits. */
export interface LimitsUsage {
  period: LimitPeriod;
  usedMs: number;
  min: number | null;
  max: number | null;
}

/** A Record with everything the Dashboard derives on read. */
export interface DashboardRow {
  record: Record;
  project: Project | null;
  client: Client | null;
  // The Workspace's Currency; without one the row has no Amount.
  currency: string | null;
  limits: LimitsUsage | null;
}

export interface CurrencyAmount {
  currency: string;
  amount: number;
}

export interface Totals {
  hours: number;
  billableHours: number;
  // One entry per Currency, in first-seen order.
  amounts: CurrencyAmount[];
}

export interface DashboardView {
  // Newest first.
  rows: DashboardRow[];
  totals: Totals;
}
