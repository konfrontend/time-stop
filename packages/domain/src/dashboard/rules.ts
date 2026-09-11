import { amountOf, isBillable } from '../money/MoneySource.js';
import type { Record } from '../record/Record.js';
import { recordDurationMs } from '../record/rules.js';
import type { DashboardRow, LimitsUsage, Totals } from './DashboardView.js';

const HOUR_MS = 3_600_000;

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
