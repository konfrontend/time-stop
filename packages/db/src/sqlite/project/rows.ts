import { and, asc, eq, type SQL } from 'drizzle-orm';
import { v7 as uuid } from 'uuid';
import type {
  ListProjectsInput,
  Project,
  ProjectInput,
  UpdateProjectInput,
} from '@time-stop/domain';
import type { Identity } from '../install/Identity.js';
import { removeEntity, upsertEntity, type Tx } from '../changes.js';
import { readClient } from '../client/rows.js';
import type { SqliteDb } from '../open.js';
import { projects, records } from '../schema.js';
import { readWorkspace } from '../workspace/rows.js';

export function listProjects(db: SqliteDb | Tx, input: ListProjectsInput): Project[] {
  const conditions: SQL[] = [];
  if (input.workspaceId) conditions.push(eq(projects.workspaceId, input.workspaceId));
  if (input.archived !== undefined) conditions.push(eq(projects.archived, input.archived));
  return db
    .select()
    .from(projects)
    .where(and(...conditions))
    .orderBy(asc(projects.name), asc(projects.id))
    .all();
}

export function readProject(tx: Tx | SqliteDb, id: string): Project {
  const project = tx.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) throw new Error(`Project ${id} not found`);
  return project;
}

function checkClient(tx: Tx, workspaceId: string, clientId: string | null): void {
  if (clientId === null) return;
  if (readClient(tx, clientId).workspaceId !== workspaceId) {
    throw new Error('A Project and its Client must share the same Workspace');
  }
}

export function insertProject(
  tx: Tx,
  identity: Identity,
  input: ProjectInput,
  at: string,
): Project {
  readWorkspace(tx, input.workspaceId);
  checkClient(tx, input.workspaceId, input.clientId);
  return upsertEntity(tx, identity, 'project', 'create', {
    id: uuid({ msecs: Date.parse(at) }),
    ...input,
    archived: false,
    updatedAt: at,
  });
}

/** A Workspace change moves the Project: its Records follow, each with an update Change, and the Client is dropped. */
export function updateProject(
  tx: Tx,
  identity: Identity,
  input: UpdateProjectInput,
  at: string,
): Project {
  const existing = readProject(tx, input.id);
  if (input.workspaceId === existing.workspaceId) {
    checkClient(tx, existing.workspaceId, input.clientId);
    return upsertEntity(tx, identity, 'project', 'update', {
      ...existing,
      ...input,
      updatedAt: at,
    });
  }
  readWorkspace(tx, input.workspaceId);
  for (const record of tx.select().from(records).where(eq(records.projectId, input.id)).all()) {
    upsertEntity(tx, identity, 'record', 'update', {
      ...record,
      workspaceId: input.workspaceId,
      updatedAt: at,
    });
  }
  return upsertEntity(tx, identity, 'project', 'update', {
    ...existing,
    ...input,
    clientId: null,
    updatedAt: at,
  });
}

function markArchived(tx: Tx, identity: Identity, id: string, archived: boolean, at: string) {
  return upsertEntity(tx, identity, 'project', 'update', {
    ...readProject(tx, id),
    archived,
    updatedAt: at,
  });
}

export function archiveProject(tx: Tx, identity: Identity, id: string, at: string): Project {
  return markArchived(tx, identity, id, true, at);
}

export function unarchiveProject(tx: Tx, identity: Identity, id: string, at: string): Project {
  return markArchived(tx, identity, id, false, at);
}

/** Records of the Project keep their Workspace and lose the reference, each with an update Change. */
export function removeProject(tx: Tx, identity: Identity, id: string, at: string): void {
  readProject(tx, id);
  for (const record of tx.select().from(records).where(eq(records.projectId, id)).all()) {
    upsertEntity(tx, identity, 'record', 'update', { ...record, projectId: null, updatedAt: at });
  }
  removeEntity(tx, identity, 'project', id, at);
}
