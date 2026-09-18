import { describe, expect, it } from 'vitest';
import type { DashboardRow } from '@time-stop/domain';
import { initialStandby, standbyOf, standbyReducer } from './standby';

const today = new Date(2026, 8, 15).toISOString();
const now = new Date(2026, 8, 15, 12).toISOString();
const local = (day: number, hour: number) => new Date(2026, 8, day, hour).toISOString();

function row(
  id: string,
  { name = '', projectId = 'p1' as string | null, start = local(15, 9), hours = 1 } = {},
): DashboardRow {
  return {
    record: {
      id,
      workspaceId: 'w1',
      projectId,
      actorId: 'a1',
      name,
      start,
      stop: new Date(Date.parse(start) + hours * 3_600_000).toISOString(),
      updatedAt: start,
    },
    project: null,
    client: null,
    currency: null,
    limits: null,
  };
}

const standby = (
  rows: DashboardRow[],
  state: Partial<Parameters<typeof standbyOf>[0]['state']> = {},
  projectId: string | null = 'p1',
) =>
  standbyOf({
    rows,
    projectId,
    state: { ...initialStandby, ...state },
    today,
    now: Date.parse(now),
  });

describe('standbyOf', () => {
  it('starts something new when nothing was tracked', () => {
    expect(standby([])).toEqual({ name: '', target: null, todayMs: 0 });
  });

  it('remembers the latest stopped Record of the Context Project, with its total today', () => {
    const rows = [
      row('r2', { name: 'Build header', start: local(15, 10) }),
      row('r1', { name: 'Build header', start: local(15, 8) }),
    ];
    const result = standby(rows);
    expect(result.name).toBe('Build header');
    expect(result.target?.record.id).toBe('r2');
    expect(result.todayMs).toBe(2 * 3_600_000);
  });

  it('remembers an untitled Record as an activity of its own', () => {
    const rows = [row('r2'), row('r1')];
    const result = standby(rows);
    expect(result.name).toBe('');
    expect(result.target?.record.id).toBe('r2');
    expect(result.todayMs).toBe(3_600_000);
  });

  it('forgets a latest Record of another Project', () => {
    const result = standby([row('r1', { name: 'Notes', projectId: 'p2' })]);
    expect(result).toEqual({ name: '', target: null, todayMs: 0 });
  });

  it('forgets what Clear let go, on the Project it was cleared for', () => {
    const rows = [row('r1', { name: 'Build header' })];
    expect(standby(rows, { cleared: { projectId: 'p1' } })).toEqual({
      name: '',
      target: null,
      todayMs: 0,
    });
    expect(standby(rows, { cleared: { projectId: 'p2' } }).target?.record.id).toBe('r1');
  });

  it('continues the activity a typed Name names', () => {
    const rows = [row('r2', { name: 'Client call' }), row('r1', { name: 'Build header' })];
    const result = standby(rows, { typed: ' Build header ' });
    expect(result.name).toBe(' Build header ');
    expect(result.target?.record.id).toBe('r1');
    expect(result.todayMs).toBe(3_600_000);
  });

  it('starts something new for a typed Name of no activity, or of another Project', () => {
    const rows = [row('r1', { name: 'Build header', projectId: 'p2' })];
    expect(standby(rows, { typed: 'Build header' }).target).toBeNull();
    expect(standby(rows, { typed: 'Something else' }).target).toBeNull();
    expect(standby(rows, { typed: '' }).target).toBeNull();
  });

  it('counts only today towards the activity total', () => {
    const rows = [
      row('r2', { name: 'Build header', start: local(15, 10) }),
      row('r1', { name: 'Build header', start: local(14, 10), hours: 3 }),
    ];
    expect(standby(rows).todayMs).toBe(3_600_000);
  });
});

describe('standbyReducer', () => {
  const step = (state = initialStandby, ...actions: Parameters<typeof standbyReducer>[1][]) =>
    actions.reduce(standbyReducer, state);

  it('keeps the draft over the remembered Record until a Timer starts or stops', () => {
    const typed = step(undefined, { type: 'typed', draft: 'Notes' });
    expect(typed.typed).toBe('Notes');
    expect(step(typed, { type: 'stopped' }).typed).toBeNull();
    expect(step(typed, { type: 'started' })).toEqual(initialStandby);
  });

  it('Clear drops the draft and remembers which Project it let go, until the next start', () => {
    const cleared = step(
      undefined,
      { type: 'typed', draft: 'Notes' },
      { type: 'cleared', projectId: 'p1' },
    );
    expect(cleared).toEqual({ typed: null, cleared: { projectId: 'p1' } });
    expect(step(cleared, { type: 'stopped' }).cleared).toEqual({ projectId: 'p1' });
    expect(step(cleared, { type: 'started' }).cleared).toBeNull();
  });
});
