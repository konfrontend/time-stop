import { asc, eq } from 'drizzle-orm';
import { v7 as uuid } from 'uuid';
import type { Workspace, WorkspaceInput } from '@time-stop/domain';
import { DEFAULT_WORKSPACE_KEY, type Identity } from './bootstrap.js';
import { appendChange, type Tx } from './changes.js';
import { deleteClientRow } from './clients.js';
import { deleteProjectRow } from './projects.js';
import type { SqliteDb } from './open.js';
import { clients, projects, records, settings, workspaces } from './schema.js';

export function listWorkspaceRows(db: SqliteDb | Tx): Workspace[] {
  return db.select().from(workspaces).orderBy(asc(workspaces.createdAt), asc(workspaces.id)).all();
}

export function readWorkspace(tx: Tx | SqliteDb, id: string): Workspace {
  const workspace = tx.select().from(workspaces).where(eq(workspaces.id, id)).get();
  if (!workspace) throw new Error(`Workspace ${id} not found`);
  return workspace;
}

export function defaultWorkspaceId(tx: Tx | SqliteDb): string {
  const id = tx.select().from(settings).where(eq(settings.key, DEFAULT_WORKSPACE_KEY)).get()?.value;
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

/** Everything the Workspace contains goes with it, each as its own delete Change. */
export function deleteWorkspaceRow(tx: Tx, identity: Identity, id: string, at: number): void {
  readWorkspace(tx, id);
  if (id === defaultWorkspaceId(tx)) throw new Error('The default Workspace cannot be deleted');

  for (const record of tx.select().from(records).where(eq(records.workspaceId, id)).all()) {
    tx.delete(records).where(eq(records.id, record.id)).run();
    appendChange(tx, identity, {
      entityKind: 'record',
      op: 'delete',
      entity: { id: record.id, updatedAt: at },
    });
  }
  for (const project of tx.select().from(projects).where(eq(projects.workspaceId, id)).all()) {
    deleteProjectRow(tx, identity, project.id, at);
  }
  for (const client of tx.select().from(clients).where(eq(clients.workspaceId, id)).all()) {
    deleteClientRow(tx, identity, client.id, at);
  }
  tx.delete(workspaces).where(eq(workspaces.id, id)).run();
  appendChange(tx, identity, {
    entityKind: 'workspace',
    op: 'delete',
    entity: { id, updatedAt: at },
  });
}
