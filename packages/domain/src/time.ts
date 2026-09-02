import { DateTime, Interval } from 'luxon';

/**
 * The only module that touches Luxon. Storage holds epoch milliseconds in UTC; conversions to
 * and from calendar time happen here and at display.
 */

/** Duration of a Record: the span from start to stop, in milliseconds. */
export function durationMs(startMs: number, stopMs: number): number {
  return Interval.fromDateTimes(DateTime.fromMillis(startMs), DateTime.fromMillis(stopMs)).length(
    'milliseconds',
  );
}
