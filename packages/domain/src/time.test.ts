import { describe, expect, it } from 'vitest';
import {
  dayStart,
  durationMs,
  formatClock,
  formatIsoDate,
  parseClock,
  parseIsoDate,
  periodBounds,
  shiftPeriod,
} from './time.js';

const zone = 'UTC';

describe('durationMs', () => {
  it('is the span from start to stop in milliseconds', () => {
    const start = Date.UTC(2026, 0, 1, 9, 0, 0);
    const stop = Date.UTC(2026, 0, 1, 10, 30, 0);
    expect(durationMs(start, stop)).toBe(90 * 60 * 1000);
  });
});

describe('periodBounds', () => {
  it('spans a calendar month', () => {
    expect(periodBounds('month', Date.UTC(2026, 8, 15, 12), zone)).toEqual({
      from: Date.UTC(2026, 8, 1),
      to: Date.UTC(2026, 9, 1),
    });
  });

  it('spans a week starting Monday', () => {
    // 2026-09-06 is a Sunday.
    expect(periodBounds('week', Date.UTC(2026, 8, 6, 12), zone)).toEqual({
      from: Date.UTC(2026, 7, 31),
      to: Date.UTC(2026, 8, 7),
    });
  });
});

describe('shiftPeriod', () => {
  it('moves the anchor by whole months and weeks', () => {
    const anchor = Date.UTC(2026, 0, 31);
    expect(shiftPeriod('month', anchor, 1, zone)).toBe(Date.UTC(2026, 1, 28));
    expect(shiftPeriod('week', anchor, -1, zone)).toBe(Date.UTC(2026, 0, 24));
  });
});

describe('dayStart', () => {
  it('is local midnight of the day', () => {
    expect(dayStart(Date.UTC(2026, 8, 6, 23, 59), zone)).toBe(Date.UTC(2026, 8, 6));
  });
});

describe('ISO dates', () => {
  it('round-trip through local midnight', () => {
    expect(parseIsoDate('2026-09-06', zone)).toBe(Date.UTC(2026, 8, 6));
    expect(formatIsoDate(Date.UTC(2026, 8, 6, 15), zone)).toBe('2026-09-06');
  });

  it('rejects malformed input', () => {
    expect(() => parseIsoDate('nope', zone)).toThrow();
  });
});

describe('parseClock', () => {
  it('places an HH:mm clock on a calendar day', () => {
    expect(parseClock('2026-09-15', '09:30', zone)).toBe(Date.UTC(2026, 8, 15, 9, 30));
  });

  it('rejects a malformed clock', () => {
    expect(() => parseClock('2026-09-15', '9h30', zone)).toThrow('Invalid');
  });
});

describe('formatClock', () => {
  it('renders the wall clock as HH:mm', () => {
    expect(formatClock(Date.UTC(2026, 8, 15, 9, 5), zone)).toBe('09:05');
  });
});
