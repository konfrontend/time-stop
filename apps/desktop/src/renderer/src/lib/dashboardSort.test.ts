import { describe, expect, it } from 'vitest';
import type { DashboardRow } from '@time-stop/domain';
import { sortByStart } from './dashboardSort';

const at = (day: number, hour: number) => new Date(2026, 8, day, hour).toISOString();

function row(id: string, start: string): DashboardRow {
  return {
    record: {
      id,
      workspaceId: 'w1',
      projectId: null,
      actorId: 'a1',
      name: '',
      start,
      stop: start,
      updatedAt: start,
    },
    project: null,
    client: null,
    currency: null,
    limits: null,
  };
}

describe('sortByStart', () => {
  it('puts the newest start first without touching the input', () => {
    const rows = [row('a', at(14, 9)), row('c', at(15, 11)), row('b', at(15, 9))];
    expect(sortByStart(rows).map((r) => r.record.id)).toEqual(['c', 'b', 'a']);
    expect(rows.map((r) => r.record.id)).toEqual(['a', 'c', 'b']);
  });
});
