import { z } from 'zod';
import { clientSchema, type Client } from '../client/Client.js';
import { projectSchema, type Project } from '../project/Project.js';
import { recordSchema, type Record } from '../record/Record.js';
import { epochMs, idSchema } from '../schema.js';
import { workspaceSchema, type Workspace } from '../workspace/Workspace.js';

export const entityKindSchema = z.enum(['workspace', 'client', 'project', 'record']);
export type EntityKind = z.infer<typeof entityKindSchema>;

export const entitySchemas = {
  workspace: workspaceSchema,
  client: clientSchema,
  project: projectSchema,
  record: recordSchema,
} as const;

export interface EntityOf {
  workspace: Workspace;
  client: Client;
  project: Project;
  record: Record;
}
export type Entity = EntityOf[EntityKind];

export const changeOpSchema = z.enum(['create', 'update', 'delete']);
export type ChangeOp = z.infer<typeof changeOpSchema>;

export const changePayloadSchema = z.union([
  workspaceSchema,
  clientSchema,
  projectSchema,
  recordSchema,
  z.object({}).strict(),
]);

/** Payload is the whole entity after the change; empty on delete. */
export const changeSchema = z.object({
  id: idSchema,
  entityKind: entityKindSchema,
  entityId: idSchema,
  op: changeOpSchema,
  payload: changePayloadSchema,
  updatedAt: epochMs,
  actorId: idSchema,
  installId: idSchema,
  pushedAt: epochMs.nullable(),
});
export type Change = z.infer<typeof changeSchema>;
