import { asc, eq } from 'drizzle-orm';
import { v7 as uuid } from 'uuid';
import type { Workspace, WorkspaceInput } from '@time-stop/domain';
import { DEFAULT_WORKSPACE_KEY } from '../install/bootstrap.js';
import type { Identity } from '../install/Identity.js';
import { removeEntity, upsertEntity, type Tx } from '../changes.js';
import { removeClient } from '../client/rows.js';
import type { SqliteDb } from '../open.js';
import { removeProject } from '../project/rows.js';
import { clients, projects, records, workspaces } from '../schema.js';
import { readSetting } from '../settings.js';

export function listWorkspaces(db: SqliteDb | Tx): Workspace[] {
  return db.select().from(workspaces).orderBy(asc(workspaces.createdAt), asc(workspaces.id)).all();
}

export function readWorkspace(tx: Tx | SqliteDb, id: string): Workspace {
  const workspace = tx.select().from(workspaces).where(eq(workspaces.id, id)).get();
  if (!workspace) throw new Error(`Workspace ${id} not found`);
  return workspace;
}

export function defaultWorkspaceId(tx: Tx | SqliteDb): string {
  const id = readSetting(tx, DEFAULT_WORKSPACE_KEY);
  if (!id) throw new Error('No default Workspace; the database was not bootstrapped');
  return id;
}

export function insertWorkspace(
  tx: Tx,
  identity: Identity,
  input: WorkspaceInput,
  at: string,
): Workspace {
  return upsertEntity(tx, identity, 'workspace', 'create', {
    id: uuid({ msecs: Date.parse(at) }),
    ...input,
    createdAt: at,
    updatedAt: at,
  });
}

export function updateWorkspace(
  tx: Tx,
  identity: Identity,
  input: WorkspaceInput & { id: string },
  at: string,
): Workspace {
  const existing = readWorkspace(tx, input.id);
  return upsertEntity(tx, identity, 'workspace', 'update', {
    ...existing,
    name: input.name,
    currency: input.currency,
    color: input.color,
    updatedAt: at,
  });
}

/** Everything the Workspace contains goes with it, each as its own Change; the default stays. */
export function removeWorkspace(tx: Tx, identity: Identity, id: string, at: string): void {
  readWorkspace(tx, id);
  if (id === defaultWorkspaceId(tx)) throw new Error('The default Workspace cannot be deleted');
  for (const record of tx.select().from(records).where(eq(records.workspaceId, id)).all()) {
    removeEntity(tx, identity, 'record', record.id, at);
  }
  for (const project of tx.select().from(projects).where(eq(projects.workspaceId, id)).all()) {
    removeProject(tx, identity, project.id, at);
  }
  for (const client of tx.select().from(clients).where(eq(clients.workspaceId, id)).all()) {
    removeClient(tx, identity, client.id, at);
  }
  removeEntity(tx, identity, 'workspace', id, at);
}
