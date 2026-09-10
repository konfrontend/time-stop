import type { Project, Record } from './entities.js';
import { durationMs } from './time.js';

export interface NewRecordInput {
  id: string;
  actorId: string;
  workspaceId: string;
  project: Project | null;
  name?: string | undefined;
  start: number;
  stop?: number | null | undefined;
  now: number;
}

export function newRecord(input: NewRecordInput): Record {
  const placed = placeInProject({ workspaceId: input.workspaceId }, input.project);
  return {
    id: input.id,
    ...placed,
    actorId: input.actorId,
    name: input.name ?? '',
    start: input.start,
    stop: input.stop ?? null,
    updatedAt: input.now,
  };
}

/**
 * Workspace and Project of a Record placed in `project`: the Workspace becomes the Project's;
 * without a Project the Workspace stays.
 */
export function placeInProject(
  record: { workspaceId: string },
  project: Project | null,
): Pick<Record, 'workspaceId' | 'projectId'> {
  if (project?.archived) throw new Error('An Archived Project accepts no new Records');
  return {
    workspaceId: project?.workspaceId ?? record.workspaceId,
    projectId: project?.id ?? null,
  };
}

export function recordDurationMs(record: Record, now: number): number {
  return durationMs(record.start, record.stop ?? now);
}
