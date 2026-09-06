import { asc, eq } from 'drizzle-orm';
import { v7 as uuid } from 'uuid';
import type { Client, ClientInput, ListClientsInput, Project } from '@time-stop/domain';
import type { Identity } from './bootstrap.js';
import { appendChange, type Tx } from './changes.js';
import type { SqliteDb } from './open.js';
import { clients, projects, workspaces } from './schema.js';

export function listClientRows(db: SqliteDb | Tx, input: ListClientsInput): Client[] {
  const query = db.select().from(clients).orderBy(asc(clients.name), asc(clients.id));
  return input.workspaceId
    ? query.where(eq(clients.workspaceId, input.workspaceId)).all()
    : query.all();
}

export function readClient(tx: Tx | SqliteDb, id: string): Client {
  const client = tx.select().from(clients).where(eq(clients.id, id)).get();
  if (!client) throw new Error(`Client ${id} not found`);
  return client;
}

export function insertClient(tx: Tx, identity: Identity, input: ClientInput, at: number): Client {
  if (!tx.select().from(workspaces).where(eq(workspaces.id, input.workspaceId)).get()) {
    throw new Error(`Workspace ${input.workspaceId} not found`);
  }
  const client: Client = { id: uuid({ msecs: at }), ...input, updatedAt: at };
  tx.insert(clients).values(client).run();
  appendChange(tx, identity, { entityKind: 'client', op: 'create', entity: client });
  return client;
}

export function updateClientRow(
  tx: Tx,
  identity: Identity,
  input: { id: string; name: string },
  at: number,
): Client {
  const updated: Client = { ...readClient(tx, input.id), name: input.name, updatedAt: at };
  tx.update(clients).set({ name: input.name, updatedAt: at }).where(eq(clients.id, input.id)).run();
  appendChange(tx, identity, { entityKind: 'client', op: 'update', entity: updated });
  return updated;
}

/** Projects of the Client stay and lose the reference, each with an update Change. */
export function deleteClientRow(tx: Tx, identity: Identity, id: string, at: number): void {
  readClient(tx, id);
  for (const project of tx.select().from(projects).where(eq(projects.clientId, id)).all()) {
    const detached: Project = { ...project, clientId: null, updatedAt: at };
    tx.update(projects)
      .set({ clientId: null, updatedAt: at })
      .where(eq(projects.id, project.id))
      .run();
    appendChange(tx, identity, { entityKind: 'project', op: 'update', entity: detached });
  }
  tx.delete(clients).where(eq(clients.id, id)).run();
  appendChange(tx, identity, { entityKind: 'client', op: 'delete', entity: { id, updatedAt: at } });
}
