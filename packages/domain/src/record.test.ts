import { describe, expect, it } from 'vitest';
import type { Project } from './entities.js';
import { uuidv7 } from './ids.js';
import { newRecord } from './record.js';

const actorId = uuidv7();
const workspaceId = uuidv7();
const otherWorkspaceId = uuidv7();

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: uuidv7(),
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

const base = { id: uuidv7(), actorId, workspaceId, start: 1000, now: 1000 };

describe('newRecord', () => {
  it('without a Project takes the given Workspace, no Rate, not Billable', () => {
    const record = newRecord({ ...base, project: null });
    expect(record).toMatchObject({
      workspaceId,
      projectId: null,
      name: '',
      stop: null,
      rate: null,
      billable: false,
    });
  });

  it('with a Project takes the Project Workspace, freezes its Rate and defaults Billable on', () => {
    const p = project();
    const record = newRecord({ ...base, project: p });
    expect(record).toMatchObject({
      workspaceId: otherWorkspaceId,
      projectId: p.id,
      rate: 110,
      billable: true,
    });
  });

  it('with an unrated Project defaults Billable off but keeps an explicit flag', () => {
    const p = project({ rate: null });
    expect(newRecord({ ...base, project: p }).billable).toBe(false);
    expect(newRecord({ ...base, project: p, billable: true }).billable).toBe(true);
  });

  it('refuses an Archived Project', () => {
    expect(() => newRecord({ ...base, project: project({ archived: true }) })).toThrow(/Archived/);
  });
});
