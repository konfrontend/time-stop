import { describe, expect, it } from 'vitest';
import {
  dayStart,
  durationMs,
  formatClock,
  formatDuration,
  formatIsoDate,
  parseClock,
  parseIsoDate,
  periodBounds,
  shiftIsoDate,
  shiftPeriod,
} from './time.js';

const zone = 'UTC';

describe('durationMs', () => {
  it('is the span from start to stop in milliseconds', () => {
    expect(durationMs('2026-01-01T09:00:00.000Z', '2026-01-01T10:30:00.000Z')).toBe(90 * 60 * 1000);
  });
});

describe('periodBounds', () => {
  it('spans a calendar month', () => {
    expect(periodBounds('month', '2026-09-15T12:00:00.000Z', zone)).toEqual({
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-10-01T00:00:00.000Z',
    });
  });

  it('spans a week starting Monday', () => {
    // 2026-09-06 is a Sunday.
    expect(periodBounds('week', '2026-09-06T12:00:00.000Z', zone)).toEqual({
      from: '2026-08-31T00:00:00.000Z',
      to: '2026-09-07T00:00:00.000Z',
    });
  });

  it('stamps local midnight in UTC', () => {
    expect(periodBounds('month', '2026-09-15T12:00:00.000Z', 'Europe/Berlin')).toEqual({
      from: '2026-08-31T22:00:00.000Z',
      to: '2026-09-30T22:00:00.000Z',
    });
  });
});

describe('shiftPeriod', () => {
  it('moves the anchor by whole months and weeks', () => {
    const anchor = '2026-01-31T00:00:00.000Z';
    expect(shiftPeriod('month', anchor, 1, zone)).toBe('2026-02-28T00:00:00.000Z');
    expect(shiftPeriod('week', anchor, -1, zone)).toBe('2026-01-24T00:00:00.000Z');
  });
});

describe('dayStart', () => {
  it('is local midnight of the day', () => {
    expect(dayStart('2026-09-06T23:59:00.000Z', zone)).toBe('2026-09-06T00:00:00.000Z');
  });
});

describe('ISO dates', () => {
  it('round-trip through local midnight', () => {
    expect(parseIsoDate('2026-09-06', zone)).toBe('2026-09-06T00:00:00.000Z');
    expect(formatIsoDate('2026-09-06T15:00:00.000Z', zone)).toBe('2026-09-06');
  });

  it('rejects malformed input', () => {
    expect(() => parseIsoDate('nope', zone)).toThrow();
  });

  it('shift by calendar days', () => {
    expect(shiftIsoDate('2026-09-30', 1, zone)).toBe('2026-10-01');
    expect(shiftIsoDate('2026-03-01', -1, zone)).toBe('2026-02-28');
  });
});

describe('parseClock', () => {
  it('places an HH:mm clock on a calendar day', () => {
    expect(parseClock('2026-09-15', '09:30', zone)).toBe('2026-09-15T09:30:00.000Z');
  });

  it('rejects a malformed clock', () => {
    expect(() => parseClock('2026-09-15', '9h30', zone)).toThrow('Invalid');
  });
});

describe('formatClock', () => {
  it('renders the wall clock as HH:mm', () => {
    expect(formatClock('2026-09-15T09:05:00.000Z', zone)).toBe('09:05');
  });
});

describe('formatDuration', () => {
  it('reads as HH:MM:SS and counts hours past a day', () => {
    expect(formatDuration(0)).toBe('00:00:00');
    expect(formatDuration(3_661_000)).toBe('01:01:01');
    expect(formatDuration(90_000_000)).toBe('25:00:00');
  });

  it('floors to whole seconds and never goes negative', () => {
    expect(formatDuration(1_999)).toBe('00:00:01');
    expect(formatDuration(-5_000)).toBe('00:00:00');
  });
});
