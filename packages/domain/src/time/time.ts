import { DateTime } from 'luxon';

/**
 * Calendar-aware time math. Storage holds ISO 8601 UTC timestamps (`timestampSchema`); this
 * module is the only place Luxon is imported, and the only place a time zone enters. `zone`
 * defaults to the local zone and exists so tests can pin one.
 */

/** A calendar week (Monday to Sunday) or calendar month. */
export type Period = 'week' | 'month';

export interface Bounds {
  // Inclusive.
  from: string;
  // Exclusive.
  to: string;
}

const at = (timestamp: string, zone: string) => DateTime.fromISO(timestamp, { zone });

// Always UTC with milliseconds, so the result satisfies timestampSchema.
const stamp = (moment: DateTime) => moment.toUTC().toISO()!;

/** Duration of a Record: the span from start to stop, in milliseconds. */
export function durationMs(start: string, stop: string): number {
  return Date.parse(stop) - Date.parse(start);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** An elapsed Duration as `HH:MM:SS`; hours run past 24 rather than rolling over. */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}

/** The calendar week (Monday to Sunday) or month containing `timestamp`. */
export function periodBounds(period: Period, timestamp: string, zone = 'local'): Bounds {
  const start = at(timestamp, zone).startOf(period);
  return { from: stamp(start), to: stamp(start.plus({ [period]: 1 })) };
}

export function shiftPeriod(
  period: Period,
  timestamp: string,
  steps: number,
  zone = 'local',
): string {
  return stamp(at(timestamp, zone).plus({ [period]: steps }));
}

export function dayStart(timestamp: string, zone = 'local'): string {
  return stamp(at(timestamp, zone).startOf('day'));
}

/** The calendar day containing `timestamp`. */
export function dayBounds(timestamp: string, zone = 'local'): Bounds {
  const start = at(timestamp, zone).startOf('day');
  return { from: stamp(start), to: stamp(start.plus({ days: 1 })) };
}

export function parseIsoDate(date: string, zone = 'local'): string {
  const parsed = DateTime.fromISO(date, { zone });
  if (!parsed.isValid) throw new Error(`Invalid date ${date}`);
  return stamp(parsed.startOf('day'));
}

export function formatIsoDate(timestamp: string, zone = 'local'): string {
  return at(timestamp, zone).toISODate()!;
}

export function shiftIsoDate(date: string, days: number, zone = 'local'): string {
  const parsed = DateTime.fromISO(date, { zone });
  if (!parsed.isValid) throw new Error(`Invalid date ${date}`);
  return parsed.plus({ days }).toISODate()!;
}

/** A wall clock as typed or shown: `HH:mm`. */
export function isClock(text: string): boolean {
  return /^\d{2}:\d{2}$/.test(text);
}

/** The moment an `HH:mm` wall clock names on a calendar day. */
export function parseClock(date: string, clock: string, zone = 'local'): string {
  const parsed = DateTime.fromISO(`${date}T${clock}`, { zone });
  if (!isClock(clock) || !parsed.isValid) throw new Error(`Invalid clock ${clock}`);
  return stamp(parsed);
}

export function formatClock(timestamp: string, zone = 'local'): string {
  return at(timestamp, zone).toFormat('HH:mm');
}
