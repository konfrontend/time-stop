import { eq } from 'drizzle-orm';
import type { Context } from '@time-stop/domain';
import type { Tx } from './changes.js';
import type { SqliteDb } from './open.js';
import { projects, settings, workspaces } from './schema.js';
import { defaultWorkspaceId, readWorkspace } from './workspaces.js';

const WORKSPACE_KEY = 'contextWorkspaceId';
const PROJECT_KEY = 'contextProjectId';

function readSetting(tx: Tx | SqliteDb, key: string): string | null {
  return tx.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
}

function writeSetting(tx: Tx, key: string, value: string | null): void {
  if (value === null) {
    tx.delete(settings).where(eq(settings.key, key)).run();
  } else {
    tx.insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
      .run();
  }
}

/**
 * Falls back to the default Workspace when nothing is stored, and repairs a stored reference
 * whose Workspace or Project has since gone (or whose Project no longer fits the Workspace).
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
  const projectId =
    project && project.workspaceId === workspaceId && !project.archived ? project.id : null;
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
