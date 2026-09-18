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

/** A row as the Dashboard shows it: the Duration rounded by the view's Rounding, the Amount priced from it. */
export interface ShownRow extends DashboardRow {
  durationMs: number;
  amount: number | null;
}

export interface CurrencyAmount {
  currency: string;
  amount: number;
}

export interface Totals {
  ms: number;
  billableMs: number;
  // One entry per Currency, in first-seen order.
  amounts: CurrencyAmount[];
}

/** The rows started on one local day, in the order given, with their summed Duration. */
export interface DashboardDay {
  day: string;
  rows: ShownRow[];
  ms: number;
}

/** What the Dashboard renders from the rows of a Range at one moment under one Rounding. */
export interface DashboardView {
  rows: ShownRow[];
  days: DashboardDay[];
  totals: Totals;
}
