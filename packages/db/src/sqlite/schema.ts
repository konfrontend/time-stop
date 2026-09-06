import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  currency: text('currency').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const clients = sqliteTable(
  'clients',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('clients_workspace_idx').on(table.workspaceId)],
);

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    clientId: text('client_id').references(() => clients.id),
    name: text('name').notNull(),
    rate: real('rate'),
    limitMin: real('limit_min'),
    limitMax: real('limit_max'),
    limitPeriod: text('limit_period', { enum: ['week', 'month'] }),
    startDate: text('start_date'),
    endDate: text('end_date'),
    color: text('color').notNull(),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('projects_workspace_idx').on(table.workspaceId)],
);

export const records = sqliteTable(
  'records',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    projectId: text('project_id').references(() => projects.id),
    actorId: text('actor_id').notNull(),
    name: text('name').notNull().default(''),
    start: integer('start').notNull(),
    stop: integer('stop'),
    rate: real('rate'),
    billable: integer('billable', { mode: 'boolean' }).notNull().default(false),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('records_actor_start_idx').on(table.actorId, table.start),
    index('records_actor_stop_idx').on(table.actorId, table.stop),
  ],
);

export const changes = sqliteTable(
  'changes',
  {
    id: text('id').primaryKey(),
    entityKind: text('entity_kind', {
      enum: ['workspace', 'client', 'project', 'record'],
    }).notNull(),
    entityId: text('entity_id').notNull(),
    op: text('op', { enum: ['create', 'update', 'delete'] }).notNull(),
    payload: text('payload', { mode: 'json' }).notNull(),
    updatedAt: integer('updated_at').notNull(),
    actorId: text('actor_id').notNull(),
    installId: text('install_id').notNull(),
    pushedAt: integer('pushed_at'),
  },
  (table) => [index('changes_pushed_idx').on(table.pushedAt)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
