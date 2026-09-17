import { projectInput } from '@time-stop/db/testing';
import type { DashboardRow, Project, Record } from '@time-stop/domain';
import type { Harness } from './harness';

/** Where a fixture that says nothing about time lands; a Record runs for an hour from here. */
const DEFAULT_START = '2026-09-15T09:00:00.000Z';
const HOUR = 3_600_000;

export function seedProject(h: Harness, overrides: Partial<Project> = {}): Promise<Project> {
  return h.api.project.create({ ...projectInput, workspaceId: h.workspace.id, ...overrides });
}

export interface RecordOverrides {
  /** Created on demand when a test does not name one. */
  project?: Project | null;
  name?: string;
  start?: string;
  stop?: string;
}

export async function seedRecord(h: Harness, overrides: RecordOverrides = {}): Promise<Record> {
  const project = overrides.project === undefined ? await seedProject(h) : overrides.project;
  const start = overrides.start ?? DEFAULT_START;
  return h.api.record.create({
    workspaceId: h.workspace.id,
    projectId: project?.id ?? null,
    name: overrides.name ?? 'Build header',
    start,
    // Derived, so a test that moves the start alone still describes a span the rules accept.
    stop: overrides.stop ?? new Date(Date.parse(start) + HOUR).toISOString(),
  });
}

/** The rows the Tracker's Recent Records list reads, derived the way the app derives them. */
export function recentRows(h: Harness, limit = 10): Promise<DashboardRow[]> {
  return h.api.dashboard.recent({ workspaceId: h.workspace.id, projectId: null, limit });
}
