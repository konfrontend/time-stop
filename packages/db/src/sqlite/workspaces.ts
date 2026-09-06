import { asc, eq } from 'drizzle-orm';
import { v7 as uuid } from 'uuid';
import type { Workspace, WorkspaceInput } from '@time-stop/domain';
import { DEFAULT_WORKSPACE_KEY, type Identity } from './bootstrap.js';
import { appendChange, type Tx } from './changes.js';
import type { SqliteDb } from './open.js';
import { workspaces } from './schema.js';
import { readSetting } from './settings.js';

export function listWorkspaceRows(db: SqliteDb | Tx): Workspace[] {
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
  at: number,
): Workspace {
  const workspace: Workspace = { id: uuid({ msecs: at }), ...input, createdAt: at, updatedAt: at };
  tx.insert(workspaces).values(workspace).run();
  appendChange(tx, identity, { entityKind: 'workspace', op: 'create', entity: workspace });
  return workspace;
}

export function updateWorkspaceRow(
  tx: Tx,
  identity: Identity,
  input: WorkspaceInput & { id: string },
  at: number,
): Workspace {
  const existing = readWorkspace(tx, input.id);
  const updated: Workspace = { ...existing, ...input, updatedAt: at };
  tx.update(workspaces)
    .set({ name: input.name, currency: input.currency, updatedAt: at })
    .where(eq(workspaces.id, input.id))
    .run();
  appendChange(tx, identity, { entityKind: 'workspace', op: 'update', entity: updated });
  return updated;
}

/** Only the row and its Change: the caller empties the Workspace first. */
export function deleteWorkspaceRow(tx: Tx, identity: Identity, id: string, at: number): void {
  if (id === defaultWorkspaceId(tx)) throw new Error('The default Workspace cannot be deleted');
  tx.delete(workspaces).where(eq(workspaces.id, id)).run();
  appendChange(tx, identity, {
    entityKind: 'workspace',
    op: 'delete',
    entity: { id, updatedAt: at },
  });
}
