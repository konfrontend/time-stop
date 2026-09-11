import { describe, expect, it } from 'vitest';
import type { Record } from '@time-stop/domain';
import { recordFormSchema, recordFormValues, toRecordFields } from './recordForm';

const day = new Date(2026, 8, 15).toISOString();
const at = (h: number, m = 0) => new Date(2026, 8, 15, h, m).toISOString();

const record: Record = {
  id: 'r1',
  workspaceId: 'w1',
  projectId: 'p1',
  actorId: 'a1',
  name: 'Redesign',
  start: at(9, 30),
  stop: at(11),
  updatedAt: '2026-09-15T09:00:00.000Z',
};

const issues = (values: object, running = false) =>
  recordFormSchema(running)
    .safeParse(values)
    .error?.issues.map((i) => [i.path.join('.'), i.message]) ?? [];

describe('recordFormValues', () => {
  it('starts a new Record on the given day with the Context Project', () => {
    expect(recordFormValues({ day, projectId: 'p2' })).toEqual({
      date: '2026-09-15',
      start: '',
      stop: '',
      projectId: 'p2',
      name: '',
    });
  });

  it('spells an existing Record out as text', () => {
    expect(recordFormValues({ record })).toEqual({
      date: '2026-09-15',
      start: '09:30',
      stop: '11:00',
      projectId: 'p1',
      name: 'Redesign',
    });
    expect(recordFormValues({ record: { ...record, stop: null, projectId: null } })).toMatchObject({
      stop: '',
      projectId: '',
    });
  });
});

describe('recordFormSchema', () => {
  const valid = recordFormValues({ record });

  it('accepts a full entry', () => {
    expect(issues(valid)).toEqual([]);
  });

  it('reports a stop before start on the stop field', () => {
    expect(issues({ ...valid, stop: '09:00' })).toEqual([['stop', 'Stop must not precede start']]);
  });

  it('needs date, start and stop', () => {
    expect(issues({ ...valid, date: '', start: '', stop: '' }).map(([path]) => path)).toEqual([
      'date',
      'start',
      'stop',
    ]);
  });

  it('lets the Timer keep an empty stop', () => {
    expect(issues({ ...valid, stop: '' }, true)).toEqual([]);
  });
});

describe('toRecordFields', () => {
  it('turns date and clocks into timestamps', () => {
    expect(toRecordFields({ ...recordFormValues({ record }), name: ' Redesign ' })).toEqual({
      projectId: 'p1',
      name: 'Redesign',
      start: at(9, 30),
      stop: at(11),
    });
    expect(
      toRecordFields({ ...recordFormValues({ record }), stop: '', projectId: '' }),
    ).toMatchObject({ stop: null, projectId: null });
  });
});
