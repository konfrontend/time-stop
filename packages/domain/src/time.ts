/**
 * Duration of a Record: the span from start to stop, in milliseconds.
 *
 * Storage holds epoch milliseconds in UTC, so this is plain arithmetic. This module is the only
 * place Luxon may be imported once calendar-aware operations (Periods, display) arrive.
 */
export function durationMs(startMs: number, stopMs: number): number {
  return stopMs - startMs;
}
