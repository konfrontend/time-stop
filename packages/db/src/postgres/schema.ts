import {
  boolean,
  customType,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { Client, Project, PushedChange, Record, Workspace } from '@time-stop/domain';
import type { Equal, Expect } from '../typeEquality.js';

/**
 * ISO 8601 UTC text sorts chronologically only under byte-wise comparison; the database locale's
 * collation does not promise that, so timestamp columns pin "C" as SQLite's BINARY does.
 */
const timestamp = customType<{ data: string }>({ dataType: () => 'text COLLATE "C"' });

// No foreign keys on purpose; the reason lives in dialectDifferences.ts.
export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  currency: text('currency'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const clients = pgTable(
  'clients',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    name: text('name').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table) => [index('clients_workspace_idx').on(table.workspaceId)],
);

export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    clientId: text('client_id'),
    name: text('name').notNull(),
    rate: doublePrecision('rate'),
    limitMin: doublePrecision('limit_min'),
    limitMax: doublePrecision('limit_max'),
    limitPeriod: text('limit_period', { enum: ['week', 'month'] }),
    startDate: text('start_date'),
    endDate: text('end_date'),
    color: text('color').notNull(),
    archived: boolean('archived').notNull().default(false),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table) => [index('projects_workspace_idx').on(table.workspaceId)],
);

export const records = pgTable(
  'records',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    projectId: text('project_id'),
    actorId: text('actor_id').notNull(),
    name: text('name').notNull().default(''),
    start: timestamp('start').notNull(),
    stop: timestamp('stop'),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table) => [
    index('records_workspace_idx').on(table.workspaceId),
    index('records_actor_start_idx').on(table.actorId, table.start),
  ],
);

export const changes = pgTable(
  'changes',
  {
    id: text('id').primaryKey(),
    entityKind: text('entity_kind', {
      enum: ['workspace', 'client', 'project', 'record'],
    }).notNull(),
    entityId: text('entity_id').notNull(),
    op: text('op', { enum: ['create', 'update', 'delete'] }).notNull(),
    payload: jsonb('payload').$type<PushedChange['payload']>().notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    actorId: text('actor_id').notNull(),
    installId: text('install_id').notNull(),
  },
  (table) => [index('changes_entity_idx').on(table.entityKind, table.entityId)],
);

export const tokens = pgTable(
  'tokens',
  {
    id: text('id').primaryKey(),
    tokenHash: text('token_hash').notNull(),
    // Null until the first push binds the Token to its Install and Actor.
    installId: text('install_id'),
    actorId: text('actor_id'),
    createdAt: timestamp('created_at').notNull(),
    revokedAt: timestamp('revoked_at'),
  },
  (table) => [uniqueIndex('tokens_hash_idx').on(table.tokenHash)],
);

// Every table with a domain entity must select exactly that entity; tokens is storage bookkeeping.
// pushedAt never leaves the Install, so changes checks against PushedChange, not Change.
export type SchemaParity = [
  Expect<Equal<typeof workspaces.$inferSelect, Workspace>>,
  Expect<Equal<typeof clients.$inferSelect, Client>>,
  Expect<Equal<typeof projects.$inferSelect, Project>>,
  Expect<Equal<typeof records.$inferSelect, Record>>,
  Expect<Equal<typeof changes.$inferSelect, PushedChange>>,
];
