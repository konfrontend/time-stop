import { describe, expect, it } from 'vitest';
import { v7 as uuid } from 'uuid';
import { amountOf, outsideLimits, overlappingIds, totalsOf } from './dashboard.js';
import type { Record } from './entities.js';

const HOUR = 3_600_000;
const now = 100 * HOUR;

function record(overrides: Partial<Record>): Record {
  return {
    id: uuid(),
    workspaceId: uuid(),
    projectId: null,
    actorId: uuid(),
    name: '',
    start: 0,
    stop: HOUR,
    rate: null,
    billable: false,
    updatedAt: 0,
    ...overrides,
  };
}

describe('amountOf', () => {
  it('is Rate × hours for a Billable Record with a Rate and a Currency', () => {
    expect(amountOf(record({ rate: 100, billable: true, stop: 1.5 * HOUR }), 'USD', now)).toBe(150);
  });

  it('is absent without Billable, a Rate, or a Currency', () => {
    expect(amountOf(record({ rate: 100, billable: false }), 'USD', now)).toBeNull();
    expect(amountOf(record({ rate: null, billable: true }), 'USD', now)).toBeNull();
    expect(amountOf(record({ rate: 100, billable: true }), null, now)).toBeNull();
  });

  it('counts a running Record up to now', () => {
    expect(
      amountOf(record({ rate: 10, billable: true, start: 98 * HOUR, stop: null }), 'USD', now),
    ).toBe(20);
  });
});

describe('overlappingIds', () => {
  it('flags both Records of an intersecting pair and none of a touching one', () => {
    const a = record({ start: 0, stop: 2 * HOUR });
    const b = record({ start: HOUR, stop: 3 * HOUR });
    const c = record({ start: 3 * HOUR, stop: 4 * HOUR });
    expect(overlappingIds([c, a, b], now)).toEqual(new Set([a.id, b.id]));
  });

  it('ends a running Record at now', () => {
    const running = record({ start: 90 * HOUR, stop: null });
    const later = record({ start: 95 * HOUR, stop: 96 * HOUR });
    const future = record({ start: 101 * HOUR, stop: 102 * HOUR });
    expect(overlappingIds([running, later, future], now)).toEqual(new Set([running.id, later.id]));
  });
});

describe('totalsOf', () => {
  it('sums hours, Billable hours and Amount per Currency, counting a running Record', () => {
    const rows = [
      { record: record({ rate: 100, billable: true, stop: 2 * HOUR }), currency: 'USD' },
      { record: record({ rate: 50, billable: true, stop: HOUR }), currency: 'EUR' },
      { record: record({ rate: 100, billable: false, stop: HOUR }), currency: 'USD' },
      {
        record: record({ rate: 100, billable: true, start: 99 * HOUR, stop: null }),
        currency: 'USD',
      },
      { record: record({ rate: 100, billable: true, stop: HOUR }), currency: null },
    ];
    expect(totalsOf(rows, now)).toEqual({
      hours: 6,
      billableHours: 5,
      amounts: [
        { currency: 'USD', amount: 300 },
        { currency: 'EUR', amount: 50 },
      ],
    });
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
