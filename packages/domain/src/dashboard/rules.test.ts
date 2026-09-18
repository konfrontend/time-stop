import { describe, expect, it } from 'vitest';
import { v7 as uuid } from 'uuid';
import { dashboardViewOf, outsideLimits, roundDurationMs, totalsOf } from './rules.js';
import type { DashboardRow } from './DashboardView.js';
import type { Record } from '../record/Record.js';

const HOUR = 3_600_000;
const MINUTE = 60_000;
const now = 100 * HOUR;
const iso = (ms: number) => new Date(ms).toISOString();

function record(overrides: Partial<Record>): Record {
  return {
    id: uuid(),
    workspaceId: uuid(),
    projectId: null,
    actorId: uuid(),
    name: '',
    start: iso(0),
    stop: iso(HOUR),
    updatedAt: iso(0),
    ...overrides,
  };
}

const rated = (rate: number | null) => ({ rate });

function row(
  overrides: Partial<Record>,
  project: { rate: number | null } | null = rated(100),
  currency: string | null = 'USD',
): DashboardRow {
  return {
    record: record(overrides),
    project: project as DashboardRow['project'],
    client: null,
    currency,
    limits: null,
  };
}

describe('dashboardViewOf', () => {
  it('sums Durations, Billable Durations and Amount per Currency, counting a running Record', () => {
    const rows = [
      row({ stop: iso(2 * HOUR) }),
      row({ stop: iso(HOUR) }, rated(50), 'EUR'),
      row({ stop: iso(HOUR) }, rated(null)),
      row({ start: iso(99 * HOUR), stop: null }),
      row({ stop: iso(HOUR) }, rated(100), null),
      row({ stop: iso(HOUR) }, null),
    ];
    expect(dashboardViewOf(rows, now).totals).toEqual({
      ms: 7 * HOUR,
      billableMs: 4 * HOUR,
      amounts: [
        { currency: 'USD', amount: 300 },
        { currency: 'EUR', amount: 50 },
      ],
    });
  });

  it('rounds each Record before pricing and summing, so Amounts follow the rounded Duration', () => {
    const rows = [row({ stop: iso(50 * MINUTE) }), row({ stop: iso(7 * MINUTE) })];
    const view = dashboardViewOf(rows, now, '15m');
    expect(view.rows.map((r) => [r.durationMs, r.amount])).toEqual([
      [45 * MINUTE, 75],
      [0, 0],
    ]);
    expect(view.totals).toEqual({
      ms: 45 * MINUTE,
      billableMs: 45 * MINUTE,
      amounts: [{ currency: 'USD', amount: 75 }],
    });
  });

  it('leaves an unpriced row without an Amount', () => {
    const [free] = dashboardViewOf([row({}, rated(null))], now).rows;
    expect(free?.amount).toBeNull();
  });

  it('groups rows by local day in the order given, with each day summing its rounded Durations', () => {
    const day = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m).toISOString();
    const rows = [
      row({ start: day(15, 10), stop: day(15, 11) }),
      row({ start: day(15, 8), stop: day(15, 8, 30) }),
      row({ start: day(14, 9), stop: day(14, 10) }),
    ];
    const { days } = dashboardViewOf(rows, now, '30m');
    expect(days.map((d) => [d.day, d.rows.map((r) => r.record.start), d.ms])).toEqual([
      [new Date(2026, 8, 15).toISOString(), [day(15, 10), day(15, 8)], 1.5 * HOUR],
      [new Date(2026, 8, 14).toISOString(), [day(14, 9)], HOUR],
    ]);
  });
});

describe('totalsOf', () => {
  it('sums what the rows show', () => {
    expect(
      totalsOf([
        { project: rated(100), currency: 'USD', durationMs: HOUR, amount: 100 },
        { project: rated(100), currency: 'USD', durationMs: 2 * HOUR, amount: 200 },
        { project: null, currency: 'USD', durationMs: HOUR, amount: null },
      ]),
    ).toEqual({
      ms: 4 * HOUR,
      billableMs: 3 * HOUR,
      amounts: [{ currency: 'USD', amount: 300 }],
    });
  });
});

describe('roundDurationMs', () => {
  it('leaves the Duration alone without Rounding', () => {
    expect(roundDurationMs(7 * MINUTE, 'none')).toBe(7 * MINUTE);
  });

  it('rounds to the nearest 15 minutes, keeping 7 minutes and 0 at 0', () => {
    expect(roundDurationMs(7 * MINUTE, '15m')).toBe(0);
    expect(roundDurationMs(0, '15m')).toBe(0);
    expect(roundDurationMs(8 * MINUTE, '15m')).toBe(15 * MINUTE);
    expect(roundDurationMs(70 * MINUTE, '15m')).toBe(75 * MINUTE);
  });

  it('rounds to the nearest 30 minutes', () => {
    expect(roundDurationMs(14 * MINUTE, '30m')).toBe(0);
    expect(roundDurationMs(15 * MINUTE, '30m')).toBe(30 * MINUTE);
    expect(roundDurationMs(70 * MINUTE, '30m')).toBe(60 * MINUTE);
  });
});

describe('outsideLimits', () => {
  it('is true below Min or above Max', () => {
    expect(outsideLimits({ period: 'week', usedMs: 5 * HOUR, min: 10, max: null })).toBe(true);
    expect(outsideLimits({ period: 'week', usedMs: 41 * HOUR, min: null, max: 40 })).toBe(true);
    expect(outsideLimits({ period: 'week', usedMs: 20 * HOUR, min: 10, max: 40 })).toBe(false);
    expect(outsideLimits({ period: 'month', usedMs: 40 * HOUR, min: null, max: 40 })).toBe(false);
  });
});
