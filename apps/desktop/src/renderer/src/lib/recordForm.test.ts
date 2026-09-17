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

const timer: Record = { ...record, stop: null };
const precise: Record = {
  ...record,
  start: new Date(2026, 8, 15, 9, 14, 37, 412).toISOString(),
  stop: new Date(2026, 8, 15, 10, 2, 5, 9).toISOString(),
};
const overnight: Record = {
  ...record,
  start: at(23, 30),
  stop: new Date(2026, 8, 16, 0, 30).toISOString(),
};

const issues = (values: object, original?: Record) =>
  recordFormSchema(original)
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
    expect(issues({ ...valid, stop: '' }, timer)).toEqual([]);
  });

  it('rejects a Timer start after now', () => {
    const running = { ...valid, stop: '' };
    const schema = recordFormSchema(timer, () => Date.parse(at(10)));
    expect(schema.safeParse({ ...running, start: '09:30' }).success).toBe(true);
    expect(
      schema
        .safeParse({ ...running, start: '10:15' })
        .error?.issues.map((i) => [i.path, i.message]),
    ).toEqual([[['start'], 'Start must not be after now']]);
  });

  it('accepts a Record that crosses midnight as it stands', () => {
    expect(issues(recordFormValues({ record: overnight }), overnight)).toEqual([]);
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

  it('keeps the seconds of a clock that was not edited', () => {
    const values = recordFormValues({ record: precise });
    expect(toRecordFields({ ...values, name: 'Renamed' }, precise)).toMatchObject({
      start: precise.start,
      stop: precise.stop,
    });
    expect(toRecordFields({ ...values, stop: '10:30' }, precise)).toMatchObject({
      start: precise.start,
      stop: at(10, 30),
    });
  });

  it('keeps the seconds when only the date moves', () => {
    const values = recordFormValues({ record: precise });
    expect(toRecordFields({ ...values, date: '2026-09-14' }, precise)).toMatchObject({
      start: new Date(2026, 8, 14, 9, 14, 37, 412).toISOString(),
      stop: new Date(2026, 8, 14, 10, 2, 5, 9).toISOString(),
    });
  });

  it('keeps the stop of a Record that crosses midnight on the next day', () => {
    const values = recordFormValues({ record: overnight });
    expect(toRecordFields({ ...values, start: '23:00' }, overnight)).toMatchObject({
      start: at(23),
      stop: overnight.stop,
    });
    expect(toRecordFields({ ...values, stop: '00:45' }, overnight)).toMatchObject({
      stop: new Date(2026, 8, 16, 0, 45).toISOString(),
    });
    expect(toRecordFields({ ...values, stop: '23:45' }, overnight)).toMatchObject({
      stop: at(23, 45),
    });
  });
});
