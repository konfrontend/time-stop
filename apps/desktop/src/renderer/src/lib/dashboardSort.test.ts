import { describe, expect, it } from 'vitest';
import type { DashboardRow } from '@time-stop/domain';
import { groupByDay, sortRows } from './dashboardSort';

const now = Date.parse('2026-09-15T12:00:00.000Z');
const at = (day: number, hour: number) => new Date(2026, 8, day, hour).toISOString();

function row(
  id: string,
  fields: { name?: string; project?: string; rate?: number | null; start: string; hours: number },
): DashboardRow {
  return {
    record: {
      id,
      workspaceId: 'w1',
      projectId: fields.project ? `p-${fields.project}` : null,
      actorId: 'a1',
      name: fields.name ?? '',
      start: fields.start,
      stop: new Date(Date.parse(fields.start) + fields.hours * 3_600_000).toISOString(),
      updatedAt: fields.start,
    },
    project: fields.project
      ? {
          id: `p-${fields.project}`,
          workspaceId: 'w1',
          clientId: null,
          name: fields.project,
          rate: fields.rate ?? 100,
          limitMin: null,
          limitMax: null,
          limitPeriod: null,
          startDate: null,
          endDate: null,
          color: '#000',
          archived: false,
          updatedAt: fields.start,
        }
      : null,
    client: null,
    currency: 'USD',
    limits: null,
  };
}

const rows = [
  row('a', { name: 'beta', project: 'Zed', start: at(14, 9), hours: 1 }),
  row('b', { name: 'Alpha', project: 'Acme', rate: 40, start: at(15, 9), hours: 2 }),
  row('c', { name: '', start: at(15, 11), hours: 0.4 }),
];
const ids = (sorted: DashboardRow[]) => sorted.map((r) => r.record.id);

describe('sortRows', () => {
  it('sorts by start either way', () => {
    expect(ids(sortRows(rows, { sort: 'start', dir: 'desc' }, now, 'none'))).toEqual([
      'c',
      'b',
      'a',
    ]);
    expect(ids(sortRows(rows, { sort: 'start', dir: 'asc' }, now, 'none'))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('sorts Names and Projects case-insensitively, the empty ones first', () => {
    expect(ids(sortRows(rows, { sort: 'name', dir: 'asc' }, now, 'none'))).toEqual(['c', 'b', 'a']);
    expect(ids(sortRows(rows, { sort: 'project', dir: 'desc' }, now, 'none'))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('sorts Duration and Amount by the rounded hours, unpriced Records last on desc', () => {
    expect(ids(sortRows(rows, { sort: 'duration', dir: 'desc' }, now, 'none'))).toEqual([
      'b',
      'a',
      'c',
    ]);
    // 0.4 h rounds to 0.5 h at 30m, still below 1 h.
    expect(ids(sortRows(rows, { sort: 'amount', dir: 'desc' }, now, '30m'))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('groupByDay', () => {
  it('splits consecutive rows by calendar day', () => {
    const sorted = sortRows(rows, { sort: 'start', dir: 'desc' }, now, 'none');
    expect(groupByDay(sorted).map((day) => ids(day.rows))).toEqual([['c', 'b'], ['a']]);
  });
});
