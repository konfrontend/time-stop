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
  billable?: boolean | undefined;
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
    billable: input.billable ?? placed.rate !== null,
    updatedAt: input.now,
  };
}

/**
 * Workspace, Project and frozen Rate of a Record placed in `project`: the Workspace becomes the
 * Project's and the Rate is snapshotted; without a Project the Workspace stays and the Rate clears.
 */
export function placeInProject(
  record: { workspaceId: string },
  project: Project | null,
): Pick<Record, 'workspaceId' | 'projectId' | 'rate'> {
  if (project?.archived) throw new Error('An Archived Project accepts no new Records');
  return {
    workspaceId: project?.workspaceId ?? record.workspaceId,
    projectId: project?.id ?? null,
    rate: project?.rate ?? null,
  };
}

export function recordDurationMs(record: Record, now: number): number {
  return durationMs(record.start, record.stop ?? now);
}
