import { asc, eq } from 'drizzle-orm';
import { v7 as uuid } from 'uuid';
import type { Client, ClientInput, ListClientsInput } from '@time-stop/domain';
import type { Identity } from './bootstrap.js';
import { removeEntity, upsertEntity, type Tx } from './changes.js';
import type { SqliteDb } from './open.js';
import { clients, projects } from './schema.js';
import { readWorkspace } from './workspaces.js';

export function listClients(db: SqliteDb | Tx, input: ListClientsInput): Client[] {
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
  readWorkspace(tx, input.workspaceId);
  return upsertEntity(tx, identity, 'client', 'create', {
    id: uuid({ msecs: at }),
    ...input,
    updatedAt: at,
  });
}

export function updateClient(
  tx: Tx,
  identity: Identity,
  input: { id: string; name: string },
  at: number,
): Client {
  const existing = readClient(tx, input.id);
  return upsertEntity(tx, identity, 'client', 'update', {
    ...existing,
    name: input.name,
    updatedAt: at,
  });
}

/** Projects of the Client stay and lose the reference, each with an update Change. */
export function removeClient(tx: Tx, identity: Identity, id: string, at: number): void {
  readClient(tx, id);
  for (const project of tx.select().from(projects).where(eq(projects.clientId, id)).all()) {
    upsertEntity(tx, identity, 'project', 'update', { ...project, clientId: null, updatedAt: at });
  }
  removeEntity(tx, identity, 'client', id, at);
}
