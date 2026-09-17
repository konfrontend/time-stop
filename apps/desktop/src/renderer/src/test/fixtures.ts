import { projectInput } from '@time-stop/db/testing';
import type { DashboardRow, Project, Record, Workspace } from '@time-stop/domain';
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

/**
 * A Project as a prop, for components that are handed one and never reach the seam. It carries the
 * same field values `seedProject` writes, so the two agree on what an ordinary Project looks like.
 */
export function aProject(overrides: Partial<Project> = {}): Project {
  return {
    id: '00000000-0000-7000-8000-000000000001',
    workspaceId: '00000000-0000-7000-8000-000000000002',
    archived: false,
    updatedAt: DEFAULT_START,
    ...projectInput,
    ...overrides,
  };
}

/**
 * A Dashboard row as a prop. Derived rows a test wants the app to compute belong in `recentRows`;
 * this is for the shapes a view has to handle but no single write produces — a Record with no
 * Project, a Workspace with no Currency, a Limit already spent.
 */
export function aDashboardRow(
  id: string,
  overrides: Partial<Omit<DashboardRow, 'record'>> & { record?: Partial<Record> } = {},
): DashboardRow {
  const project = overrides.project === undefined ? aProject() : overrides.project;
  return {
    project,
    client: null,
    currency: 'USD',
    limits: null,
    ...overrides,
    record: {
      id,
      workspaceId: project?.workspaceId ?? '00000000-0000-7000-8000-000000000002',
      projectId: project?.id ?? null,
      actorId: '00000000-0000-7000-8000-000000000003',
      name: 'Redesign',
      start: DEFAULT_START,
      stop: new Date(Date.parse(DEFAULT_START) + HOUR).toISOString(),
      updatedAt: DEFAULT_START,
      ...overrides.record,
    },
  };
}

export interface WorkspaceOverrides {
  name?: string;
  currency?: string | null;
  color?: string;
}

/**
 * Renames the Workspace `bootstrap` seeds. It arrives called Default with no Currency, and a
 * Currency is what decides whether a rated Record reads as Billable.
 */
export function nameWorkspace(h: Harness, overrides: WorkspaceOverrides = {}): Promise<Workspace> {
  return h.api.workspace.update({
    id: h.workspace.id,
    name: overrides.name ?? 'Work',
    currency: overrides.currency === undefined ? 'USD' : overrides.currency,
    color: overrides.color ?? '#4f6bd9',
  });
}
