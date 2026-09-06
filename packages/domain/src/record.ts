import type { Project, Record } from './entities.js';
import { durationMs } from './time.js';

export interface NewRecordInput {
  id: string;
  actorId: string;
  workspaceId: string;
  project: Project | null;
  name?: string;
  start: number;
  stop?: number | null;
  billable?: boolean;
  now: number;
}

export function newRecord(input: NewRecordInput): Record {
  const { project } = input;
  if (project?.archived) throw new Error('An Archived Project accepts no new Records');
  const rate = project?.rate ?? null;
  return {
    id: input.id,
    workspaceId: project ? project.workspaceId : input.workspaceId,
    projectId: project?.id ?? null,
    actorId: input.actorId,
    name: input.name ?? '',
    start: input.start,
    stop: input.stop ?? null,
    rate,
    billable: input.billable ?? rate !== null,
    updatedAt: input.now,
  };
}

export function recordDurationMs(record: Record, now: number): number {
  return durationMs(record.start, record.stop ?? now);
}
