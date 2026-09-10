import {
  bigint,
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const epochMs = (name: string) => bigint(name, { mode: 'number' });

/**
 * The mirror carries no foreign keys: Changes land in Install order across batches, and a
 * stale-skipped Change must never make a batch fail.
 */
export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  currency: text('currency'),
  createdAt: epochMs('created_at').notNull(),
  updatedAt: epochMs('updated_at').notNull(),
});

export const clients = pgTable(
  'clients',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    name: text('name').notNull(),
    updatedAt: epochMs('updated_at').notNull(),
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
    updatedAt: epochMs('updated_at').notNull(),
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
    start: epochMs('start').notNull(),
    stop: epochMs('stop'),
    updatedAt: epochMs('updated_at').notNull(),
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
    payload: jsonb('payload').notNull(),
    updatedAt: epochMs('updated_at').notNull(),
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
    createdAt: epochMs('created_at').notNull(),
    revokedAt: epochMs('revoked_at'),
  },
  (table) => [uniqueIndex('tokens_hash_idx').on(table.tokenHash)],
);
