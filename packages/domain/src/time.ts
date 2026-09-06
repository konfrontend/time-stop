import { DateTime } from 'luxon';

/**
 * Calendar-aware time math. Storage holds epoch milliseconds in UTC; this module is the only
 * place Luxon is imported, and the only place a time zone enters. `zone` defaults to the local
 * zone and exists so tests can pin one.
 */

/** A calendar week (Monday to Sunday) or calendar month. */
export type Period = 'week' | 'month';

export interface Bounds {
  // Inclusive.
  from: number;
  // Exclusive.
  to: number;
}

const at = (ms: number, zone: string) => DateTime.fromMillis(ms, { zone });

/** Duration of a Record: the span from start to stop, in milliseconds. */
export function durationMs(startMs: number, stopMs: number): number {
  return stopMs - startMs;
}

/** The calendar week (Monday to Sunday) or month containing `ms`. */
export function periodBounds(period: Period, ms: number, zone = 'local'): Bounds {
  const start = at(ms, zone).startOf(period);
  return { from: start.toMillis(), to: start.plus({ [period]: 1 }).toMillis() };
}

export function shiftPeriod(period: Period, ms: number, steps: number, zone = 'local'): number {
  return at(ms, zone)
    .plus({ [period]: steps })
    .toMillis();
}

export function dayStart(ms: number, zone = 'local'): number {
  return at(ms, zone).startOf('day').toMillis();
}

export function parseIsoDate(date: string, zone = 'local'): number {
  const parsed = DateTime.fromISO(date, { zone });
  if (!parsed.isValid) throw new Error(`Invalid date ${date}`);
  return parsed.startOf('day').toMillis();
}

export function formatIsoDate(ms: number, zone = 'local'): string {
  return at(ms, zone).toISODate()!;
}
