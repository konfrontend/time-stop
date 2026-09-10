import { describe, expect, it } from 'vitest';
import { v7 as uuid } from 'uuid';
import { outsideLimits, totalsOf } from './dashboard.js';
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
    updatedAt: 0,
    ...overrides,
  };
}

const rated = (rate: number | null) => ({ rate });

describe('totalsOf', () => {
  it('sums hours, Billable hours and Amount per Currency, counting a running Record', () => {
    const rows = [
      { record: record({ stop: 2 * HOUR }), project: rated(100), currency: 'USD' },
      { record: record({ stop: HOUR }), project: rated(50), currency: 'EUR' },
      { record: record({ stop: HOUR }), project: rated(null), currency: 'USD' },
      { record: record({ start: 99 * HOUR, stop: null }), project: rated(100), currency: 'USD' },
      { record: record({ stop: HOUR }), project: rated(100), currency: null },
      { record: record({ stop: HOUR }), project: null, currency: 'USD' },
    ];
    expect(totalsOf(rows, now)).toEqual({
      hours: 7,
      billableHours: 4,
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
