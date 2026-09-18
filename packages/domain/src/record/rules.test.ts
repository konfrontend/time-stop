import { describe, expect, it } from 'vitest';
import type { Project } from '../project/Project.js';
import { v7 as uuid } from 'uuid';
import { acceptsRecords, newRecord, recordDurationMs } from './rules.js';

const actorId = uuid();
const workspaceId = uuid();
const otherWorkspaceId = uuid();

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: uuid(),
    workspaceId: otherWorkspaceId,
    clientId: null,
    name: 'Acme API',
    rate: 110,
    limitMin: null,
    limitMax: null,
    limitPeriod: null,
    startDate: null,
    endDate: null,
    color: '#4f6bd9',
    archived: false,
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

const start = '2026-09-11T09:00:00.000Z';
const base = { id: uuid(), actorId, workspaceId, start, now: start };

describe('newRecord', () => {
  it('without a Project takes the given Workspace', () => {
    const record = newRecord({ ...base, project: null });
    expect(record).toEqual({
      id: base.id,
      workspaceId,
      projectId: null,
      actorId,
      name: '',
      start,
      stop: null,
      updatedAt: start,
    });
  });

  it('with a Project takes the Project Workspace', () => {
    const p = project();
    const record = newRecord({ ...base, project: p });
    expect(record).toMatchObject({ workspaceId: otherWorkspaceId, projectId: p.id });
  });

  it('refuses an Archived Project', () => {
    expect(() => newRecord({ ...base, project: project({ archived: true }) })).toThrow(/Archived/);
  });
});

describe('recordDurationMs', () => {
  it('measures a stopped Record by its stop and a Timer by now', () => {
    const record = newRecord({ ...base, project: null });
    const now = Date.parse(start) + 8000;
    expect(recordDurationMs({ ...record, stop: '2026-09-11T09:00:03.000Z' }, now)).toBe(3000);
    expect(recordDurationMs(record, now)).toBe(8000);
  });
});

describe('acceptsRecords', () => {
  it('holds for no Project and an active one, not an Archived one', () => {
    expect(acceptsRecords(null)).toBe(true);
    expect(acceptsRecords(project())).toBe(true);
    expect(acceptsRecords(project({ archived: true }))).toBe(false);
  });
});
