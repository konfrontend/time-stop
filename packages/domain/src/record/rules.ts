import type { z } from 'zod';
import type { Project } from '../project/Project.js';
import { durationMs } from '../time/time.js';
import type { Record } from './Record.js';

export interface NewRecordInput {
  id: string;
  actorId: string;
  workspaceId: string;
  project: Project | null;
  name?: string | undefined;
  start: string;
  stop?: string | null | undefined;
  now: string;
}

export function newRecord(input: NewRecordInput): Record {
  const assigned = assignProject({ workspaceId: input.workspaceId }, input.project);
  return {
    id: input.id,
    ...assigned,
    actorId: input.actorId,
    name: input.name ?? '',
    start: input.start,
    stop: input.stop ?? null,
    updatedAt: input.now,
  };
}

/**
 * Workspace and Project of a Record assigned to `project`: the Workspace becomes the Project's;
 * without a Project the Workspace stays. An Archived Project accepts no Records.
 */
export function assignProject(
  record: { workspaceId: string },
  project: Project | null,
): Pick<Record, 'workspaceId' | 'projectId'> {
  if (!acceptsRecords(project)) throw new Error('An Archived Project accepts no new Records');
  return {
    workspaceId: project?.workspaceId ?? record.workspaceId,
    projectId: project?.id ?? null,
  };
}

export function acceptsRecords(project: Pick<Project, 'archived'> | null): boolean {
  return !project?.archived;
}

export function recordDurationMs(record: Record, now: number): number {
  return record.stop === null
    ? now - Date.parse(record.start)
    : durationMs(record.start, record.stop);
}

export function validateRecordSpan(
  record: { start: string; stop: string | null },
  ctx: z.RefinementCtx,
): void {
  if (record.stop !== null && record.stop < record.start) {
    ctx.addIssue({ code: 'custom', path: ['stop'], message: 'Stop must not precede start' });
  }
}
