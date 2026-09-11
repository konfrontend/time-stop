import { eq } from 'drizzle-orm';
import type { Context } from '@time-stop/domain';
import type { Tx } from '../changes.js';
import type { SqliteDb } from '../open.js';
import { projects, workspaces } from '../schema.js';
import { readSetting, writeSetting } from '../settings.js';
import { defaultWorkspaceId, readWorkspace } from '../workspace/rows.js';

const WORKSPACE_KEY = 'contextWorkspaceId';
const PROJECT_KEY = 'contextProjectId';

/**
 * Falls back to the default Workspace when nothing is stored, and repairs a stored reference
 * whose Workspace or Project has since been deleted (or whose Project no longer fits the
 * Workspace). An Archived Project is left in place so starting a Timer on it is refused.
 */
export function readContext(tx: Tx | SqliteDb): Context {
  const storedWorkspace = readSetting(tx, WORKSPACE_KEY);
  const workspaceId =
    storedWorkspace && tx.select().from(workspaces).where(eq(workspaces.id, storedWorkspace)).get()
      ? storedWorkspace
      : defaultWorkspaceId(tx);
  const storedProject = readSetting(tx, PROJECT_KEY);
  const project = storedProject
    ? tx.select().from(projects).where(eq(projects.id, storedProject)).get()
    : undefined;
  const projectId = project && project.workspaceId === workspaceId ? project.id : null;
  return { workspaceId, projectId };
}

/** A Project outside the Workspace is dropped; an Archived or unknown one is refused. */
export function writeContext(tx: Tx, input: Context): Context {
  readWorkspace(tx, input.workspaceId);
  let projectId: string | null = null;
  if (input.projectId !== null) {
    const project = tx.select().from(projects).where(eq(projects.id, input.projectId)).get();
    if (!project) throw new Error(`Project ${input.projectId} not found`);
    if (project.archived) throw new Error('An Archived Project cannot be the Context');
    if (project.workspaceId === input.workspaceId) projectId = project.id;
  }
  writeSetting(tx, WORKSPACE_KEY, input.workspaceId);
  writeSetting(tx, PROJECT_KEY, projectId);
  return { workspaceId: input.workspaceId, projectId };
}

/** Archiving the Context's Project drops it so the next Timer lands in the Workspace alone. */
export function clearContextProject(tx: Tx, projectId: string): void {
  if (readSetting(tx, PROJECT_KEY) === projectId) writeSetting(tx, PROJECT_KEY, null);
}
