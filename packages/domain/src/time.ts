import { DateTime, Interval } from 'luxon';

/**
 * Duration of a Record: the span from start to stop, in milliseconds.
 *
 * This is the only module that touches Luxon. Storage holds epoch milliseconds in UTC;
 * conversions to and from calendar time happen here and at display.
 */
export function durationMs(startMs: number, stopMs: number): number {
  return Interval.fromDateTimes(DateTime.fromMillis(startMs), DateTime.fromMillis(stopMs)).length(
    'milliseconds',
  );
}
