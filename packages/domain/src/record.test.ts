import { describe, expect, it } from 'vitest';
import type { Project } from './entities.js';
import { v7 as uuid } from 'uuid';
import { newRecord, recordDurationMs } from './record.js';

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
    updatedAt: 0,
    ...overrides,
  };
}

const base = { id: uuid(), actorId, workspaceId, start: 1000, now: 1000 };

describe('newRecord', () => {
  it('without a Project takes the given Workspace', () => {
    const record = newRecord({ ...base, project: null });
    expect(record).toEqual({
      id: base.id,
      workspaceId,
      projectId: null,
      actorId,
      name: '',
      start: 1000,
      stop: null,
      updatedAt: 1000,
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
    expect(recordDurationMs({ ...record, stop: 4000 }, 9000)).toBe(3000);
    expect(recordDurationMs(record, 9000)).toBe(8000);
  });
});
