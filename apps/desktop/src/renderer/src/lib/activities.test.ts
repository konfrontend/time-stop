import { describe, expect, it } from 'vitest';
import type { DashboardRow } from '@app/domain';
import { groupActivities } from './activities';

const row = (id: string, name: string, projectId: string | null): DashboardRow => ({
  record: {
    id,
    workspaceId: 'w1',
    projectId,
    actorId: 'a1',
    name,
    start: '2026-09-15T09:00:00.000Z',
    stop: '2026-09-15T10:00:00.000Z',
    updatedAt: '2026-09-15T10:00:00.000Z',
  },
  project: null,
  client: null,
  currency: null,
  limits: null,
});

describe('groupActivities', () => {
  it('gathers the Records of one Project and Name, in order of last use', () => {
    const activities = groupActivities([
      row('r1', 'Build header', 'p1'),
      row('r2', 'Notes', 'p2'),
      row('r3', 'Build header', 'p1'),
    ]);
    expect(activities.map((activity) => activity.rows.map(({ record }) => record.id))).toEqual([
      ['r1', 'r3'],
      ['r2'],
    ]);
  });

  it('keeps the same Name under different Projects apart', () => {
    const activities = groupActivities([
      row('r1', 'Build header', 'p1'),
      row('r2', 'Build header', 'p2'),
      row('r3', 'Build header', null),
    ]);
    expect(activities).toHaveLength(3);
  });

  it('makes every untitled Record an activity of its own', () => {
    const activities = groupActivities([row('r1', '', 'p1'), row('r2', '', 'p1')]);
    expect(activities.map(({ key }) => key)).toEqual(['r1', 'r2']);
  });
});
