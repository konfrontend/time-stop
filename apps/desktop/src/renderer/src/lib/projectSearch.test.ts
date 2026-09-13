import { describe, expect, it } from 'vitest';
import type { Project } from '@time-stop/domain';
import { findProjects } from './projectSearch';

const project = (id: string, name: string, archived = false): Project => ({
  id,
  workspaceId: 'w1',
  clientId: null,
  name,
  rate: null,
  limitMin: null,
  limitMax: null,
  limitPeriod: null,
  startDate: null,
  endDate: null,
  color: '#000',
  archived,
  updatedAt: '2026-09-01T00:00:00.000Z',
});

const projects = [project('a', 'Acme API'), project('b', 'Website'), project('c', 'Old', true)];
const rows = [
  { record: { projectId: 'b', name: 'Fix the API docs' } },
  { record: { projectId: 'a', name: 'Review' } },
];

describe('findProjects', () => {
  it('lists every unpicked, unarchived Project for an empty query', () => {
    expect(findProjects('', projects, ['b'], rows).map((hit) => hit.project.id)).toEqual(['a']);
  });

  it('matches a Project by its Name, else by a Record Name with a hint', () => {
    expect(findProjects('api', projects, [], rows)).toEqual([
      { project: projects[0], hint: null },
      { project: projects[1], hint: 'Fix the API docs' },
    ]);
    expect(findProjects('nothing', projects, [], rows)).toEqual([]);
  });
});
