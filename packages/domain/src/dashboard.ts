import type { Client, LimitPeriod, Project, Record } from './entities.js';
import { amountOf, isBillable } from './money.js';
import { recordDurationMs } from './record.js';

const HOUR_MS = 3_600_000;

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

export function hoursOf(record: Record, now: number): number {
  return recordDurationMs(record, now) / HOUR_MS;
}

export function totalsOf(
  rows: readonly Pick<DashboardRow, 'record' | 'project' | 'currency'>[],
  now: number,
): Totals {
  const totals: Totals = { hours: 0, billableHours: 0, amounts: [] };
  for (const row of rows) {
    const { currency } = row;
    const hours = hoursOf(row.record, now);
    totals.hours += hours;
    if (isBillable(row)) totals.billableHours += hours;
    const amount = amountOf(row, hours);
    if (amount === null || currency === null) continue;
    const entry = totals.amounts.find((a) => a.currency === currency);
    if (entry) entry.amount += amount;
    else totals.amounts.push({ currency, amount });
  }
  return totals;
}

export function outsideLimits(usage: LimitsUsage): boolean {
  const used = usage.usedMs / HOUR_MS;
  return (usage.min !== null && used < usage.min) || (usage.max !== null && used > usage.max);
}
