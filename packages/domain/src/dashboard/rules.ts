import { amountOf, isBillable } from '../money/MoneySource.js';
import type { Record } from '../record/Record.js';
import { recordDurationMs } from '../record/rules.js';
import type { DashboardRow, LimitsUsage, Totals } from './DashboardView.js';
import type { Rounding } from './Rounding.js';

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const stepMs: { [step in Exclude<Rounding, 'none'>]: number } = {
  '15m': 15 * MINUTE_MS,
  '30m': 30 * MINUTE_MS,
};

/** Plain nearest: 7 minutes becomes 0 and 0 stays 0. */
export function roundDurationMs(ms: number, rounding: Rounding): number {
  if (rounding === 'none') return ms;
  const step = stepMs[rounding];
  return Math.round(ms / step) * step;
}

export function hoursOf(record: Record, now: number, rounding: Rounding = 'none'): number {
  return roundDurationMs(recordDurationMs(record, now), rounding) / HOUR_MS;
}

export function totalsOf(
  rows: readonly Pick<DashboardRow, 'record' | 'project' | 'currency'>[],
  now: number,
  rounding: Rounding = 'none',
): Totals {
  const totals: Totals = { hours: 0, billableHours: 0, amounts: [] };
  for (const row of rows) {
    const { currency } = row;
    const hours = hoursOf(row.record, now, rounding);
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
