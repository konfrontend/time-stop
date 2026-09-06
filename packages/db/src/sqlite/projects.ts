import { and, asc, eq, type SQL } from 'drizzle-orm';
import { v7 as uuid } from 'uuid';
import type {
  ListProjectsInput,
  Project,
  ProjectInput,
  Record,
  UpdateProjectInput,
} from '@time-stop/domain';
import type { Identity } from './bootstrap.js';
import { appendChange, type Tx } from './changes.js';
import { readClient } from './clients.js';
import type { SqliteDb } from './open.js';
import { projects, records, workspaces } from './schema.js';

export function listProjectRows(db: SqliteDb | Tx, input: ListProjectsInput): Project[] {
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
  at: number,
): Project {
  if (!tx.select().from(workspaces).where(eq(workspaces.id, input.workspaceId)).get()) {
    throw new Error(`Workspace ${input.workspaceId} not found`);
  }
  checkClient(tx, input.workspaceId, input.clientId);
  const project: Project = { id: uuid({ msecs: at }), ...input, archived: false, updatedAt: at };
  tx.insert(projects).values(project).run();
  appendChange(tx, identity, { entityKind: 'project', op: 'create', entity: project });
  return project;
}

function writeProject(tx: Tx, identity: Identity, updated: Project): Project {
  const { id, ...fields } = updated;
  tx.update(projects).set(fields).where(eq(projects.id, id)).run();
  appendChange(tx, identity, { entityKind: 'project', op: 'update', entity: updated });
  return updated;
}

export function updateProjectRow(
  tx: Tx,
  identity: Identity,
  input: UpdateProjectInput,
  at: number,
): Project {
  const existing = readProject(tx, input.id);
  checkClient(tx, existing.workspaceId, input.clientId);
  return writeProject(tx, identity, { ...existing, ...input, updatedAt: at });
}

export function setProjectArchived(
  tx: Tx,
  identity: Identity,
  id: string,
  archived: boolean,
  at: number,
): Project {
  return writeProject(tx, identity, { ...readProject(tx, id), archived, updatedAt: at });
}

/** Records of the Project keep their Workspace and lose the reference, each with an update Change. */
export function deleteProjectRow(tx: Tx, identity: Identity, id: string, at: number): void {
  readProject(tx, id);
  for (const record of tx.select().from(records).where(eq(records.projectId, id)).all()) {
    const detached: Record = { ...record, projectId: null, updatedAt: at };
    tx.update(records)
      .set({ projectId: null, updatedAt: at })
      .where(eq(records.id, record.id))
      .run();
    appendChange(tx, identity, { entityKind: 'record', op: 'update', entity: detached });
  }
  tx.delete(projects).where(eq(projects.id, id)).run();
  appendChange(tx, identity, {
    entityKind: 'project',
    op: 'delete',
    entity: { id, updatedAt: at },
  });
}
