import { amountOf, isBillable } from '../money/MoneySource.js';
import { recordDurationMs } from '../record/rules.js';
import { dayStart } from '../time/time.js';
import type {
  DashboardDay,
  DashboardRow,
  DashboardView,
  LimitsUsage,
  ShownRow,
  Totals,
} from './DashboardView.js';
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

function shownRowOf(row: DashboardRow, now: number, rounding: Rounding): ShownRow {
  const durationMs = roundDurationMs(recordDurationMs(row.record, now), rounding);
  return { ...row, durationMs, amount: amountOf(row, durationMs / HOUR_MS) };
}

/** Sums shown values, so the totals agree with what the rows print. */
export function totalsOf(
  rows: readonly Pick<ShownRow, 'project' | 'currency' | 'durationMs' | 'amount'>[],
): Totals {
  const totals: Totals = { ms: 0, billableMs: 0, amounts: [] };
  for (const row of rows) {
    const { currency, durationMs, amount } = row;
    totals.ms += durationMs;
    if (isBillable(row)) totals.billableMs += durationMs;
    if (amount === null || currency === null) continue;
    const entry = totals.amounts.find((a) => a.currency === currency);
    if (entry) entry.amount += amount;
    else totals.amounts.push({ currency, amount });
  }
  return totals;
}

/** Rows keep their order; days follow the order their first row appears in. */
export function dashboardViewOf(
  rows: readonly DashboardRow[],
  now: number,
  rounding: Rounding = 'none',
): DashboardView {
  const shown = rows.map((row) => shownRowOf(row, now, rounding));
  const days = new Map<string, DashboardDay>();
  for (const row of shown) {
    const day = dayStart(row.record.start);
    const entry = days.get(day);
    if (entry) {
      entry.rows.push(row);
      entry.ms += row.durationMs;
    } else {
      days.set(day, { day, rows: [row], ms: row.durationMs });
    }
  }
  return { rows: shown, days: [...days.values()], totals: totalsOf(shown) };
}

export function outsideLimits(usage: LimitsUsage): boolean {
  const used = usage.usedMs / HOUR_MS;
  return (usage.min !== null && used < usage.min) || (usage.max !== null && used > usage.max);
}
