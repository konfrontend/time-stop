import { and, count, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import { can, serverInputSchema } from '@time-stop/domain';
import type {
  Context,
  ContextListener,
  CountRecordsInput,
  DashboardInput,
  ExportReportInput,
  ListRecordsInput,
  Permission,
  Record,
  ServerSettings,
  TimeStopApi,
  TimerListener,
} from '@time-stop/domain';
import type { Identity } from './bootstrap.js';
import type { Tx } from './changes.js';
import { removeClient, insertClient, listClients, updateClient } from './clients.js';
import { clearContextProject, readContext, writeContext } from './context.js';
import { readDashboard } from './dashboard.js';
import type { SqliteDb } from './open.js';
import {
  removeProject,
  insertProject,
  listProjects,
  archiveProject,
  updateProject,
} from './projects.js';
import { createPusher, type Pusher } from './pusher.js';
import { readReport } from './report.js';
import { readServer, writeServer } from './server.js';
import { records } from './schema.js';
import {
  removeRecord,
  insertRecord,
  listRecentNames,
  renameRecord,
  readTimer,
  startTimer,
  stopTimer,
  updateRecord,
} from './records.js';
import { removeWorkspace, insertWorkspace, listWorkspaces, updateWorkspace } from './workspaces.js';

const RECENT_NAMES = 10;

const shallowEqual = (a: Record | null, b: Record | null): boolean =>
  a === b ||
  (a !== null && b !== null && (Object.keys(a) as Array<keyof Record>).every((k) => a[k] === b[k]));

const sameContext = (a: Context, b: Context): boolean =>
  a.workspaceId === b.workspaceId && a.projectId === b.projectId;

export interface SqliteApiOptions extends Identity {
  db: SqliteDb;
  now?: () => number;
  /** The mirror to the Server; the caller keeps the handle it needs to stop at quit. */
  pusher?: Pusher;
}

export function createSqliteApi(options: SqliteApiOptions): TimeStopApi {
  const { db, installId, actorId, role } = options;
  const now = options.now ?? Date.now;
  const identity: Identity = { installId, actorId, role };
  const timerListeners = new Set<TimerListener>();
  const contextListeners = new Set<ContextListener>();
  const pusher = options.pusher ?? createPusher({ db, now });

  /**
   * Every write goes through here: the pusher wakes as soon as the Change has landed, and
   * whatever the write moved is published. The Timer counts as moved on any field, so a Name
   * edit on the running one still notifies; the Context on either id.
   */
  function commit<T>(write: (tx: Tx) => T): T {
    const timerBefore = readTimer(db, actorId);
    const contextBefore = readContext(db);
    const result = db.transaction(write);
    pusher.kick();
    const timerAfter = readTimer(db, actorId);
    if (!shallowEqual(timerBefore, timerAfter)) {
      for (const listener of timerListeners) listener(timerAfter);
    }
    const contextAfter = readContext(db);
    if (!sameContext(contextBefore, contextAfter)) {
      for (const listener of contextListeners) listener(contextAfter);
    }
    return result;
  }

  function require(permission: Permission): void {
    if (!can(role, permission)) throw new Error(`Role ${role} lacks ${permission}`);
  }

  function server(): ServerSettings {
    const { url, token } = readServer(db);
    return { url, tokenSet: token !== null, databasePath: db.$client.name };
  }

  return {
    workspace: {
      async list() {
        require('workspace:read');
        return listWorkspaces(db);
      },
      async create(input) {
        require('workspace:write');
        return commit((tx) => insertWorkspace(tx, identity, input, now()));
      },
      async update(input) {
        require('workspace:write');
        return commit((tx) => updateWorkspace(tx, identity, input, now()));
      },
      async delete({ id }) {
        require('workspace:write');
        commit((tx) => removeWorkspace(tx, identity, id, now()));
      },
    },

    client: {
      async list(input = {}) {
        require('client:read');
        return listClients(db, input);
      },
      async create(input) {
        require('client:write');
        return commit((tx) => insertClient(tx, identity, input, now()));
      },
      async update(input) {
        require('client:write');
        return commit((tx) => updateClient(tx, identity, input, now()));
      },
      async delete({ id }) {
        require('client:write');
        commit((tx) => removeClient(tx, identity, id, now()));
      },
    },

    project: {
      async list(input = {}) {
        require('project:read');
        return listProjects(db, input);
      },
      async create(input) {
        require('project:write');
        return commit((tx) => insertProject(tx, identity, input, now()));
      },
      async update(input) {
        require('project:write');
        return commit((tx) => updateProject(tx, identity, input, now()));
      },
      async archive({ id }) {
        require('project:write');
        return commit((tx) => {
          clearContextProject(tx, id);
          return archiveProject(tx, identity, id, true, now());
        });
      },
      async unarchive({ id }) {
        require('project:write');
        return commit((tx) => archiveProject(tx, identity, id, false, now()));
      },
      async delete({ id }) {
        require('project:write');
        commit((tx) => removeProject(tx, identity, id, now()));
      },
    },

    record: {
      async create(input) {
        require('record:write');
        return commit((tx) => insertRecord(tx, identity, input, now()));
      },

      async update(input) {
        require('record:write');
        return commit((tx) => updateRecord(tx, identity, input, now()));
      },

      async delete({ id }) {
        require('record:write');
        commit((tx) => removeRecord(tx, identity, id, now()));
      },

      async list({ from, to }: ListRecordsInput) {
        require('record:read');
        return db
          .select()
          .from(records)
          .where(and(eq(records.actorId, actorId), gte(records.start, from), lt(records.start, to)))
          .orderBy(desc(records.start))
          .all();
      },

      async count(input: CountRecordsInput) {
        require('record:read');
        const conditions: SQL[] = [eq(records.actorId, actorId)];
        if (input.workspaceId) conditions.push(eq(records.workspaceId, input.workspaceId));
        if (input.projectId) conditions.push(eq(records.projectId, input.projectId));
        return db
          .select({ count: count() })
          .from(records)
          .where(and(...conditions))
          .get()!.count;
      },

      async recentNames({ projectId }) {
        require('record:read');
        return listRecentNames(db, actorId, projectId, RECENT_NAMES);
      },

      async startTimer() {
        require('record:write');
        return commit((tx) => startTimer(tx, identity, now()));
      },

      async stopTimer() {
        require('record:write');
        return commit((tx) => {
          const running = readTimer(tx, actorId);
          return running ? stopTimer(tx, identity, running, now()) : null;
        });
      },

      async getTimer() {
        require('record:read');
        return readTimer(db, actorId);
      },

      async updateName({ id, name }) {
        require('record:write');
        return commit((tx) => renameRecord(tx, identity, id, name, now()));
      },

      onTimerChanged(listener) {
        timerListeners.add(listener);
        return () => {
          timerListeners.delete(listener);
        };
      },
    },

    context: {
      async get() {
        require('settings:read');
        return readContext(db);
      },
      async set(input) {
        require('settings:write');
        return commit((tx) => writeContext(tx, input));
      },
      onContextChanged(listener) {
        contextListeners.add(listener);
        return () => {
          contextListeners.delete(listener);
        };
      },
    },

    dashboard: {
      async get(input: DashboardInput) {
        require('record:read');
        return readDashboard(db, actorId, input, now());
      },
    },

    report: {
      async export(input: ExportReportInput) {
        require('record:read');
        return readReport(db, actorId, input, now());
      },
    },

    sync: {
      async getServer() {
        require('settings:read');
        return server();
      },
      async setServer(input) {
        require('settings:write');
        // Parsed here as well as at the boundary, so every caller stores one URL shape.
        const { url, token } = serverInputSchema.parse(input);
        const replacement = token === null ? { url } : { url, token };
        db.transaction((tx) => writeServer(tx, replacement));
        // Only a replaced Token clears a halt; a URL edit alone leaves the refusal standing.
        if (token === null) pusher.kick();
        else pusher.resume();
        return server();
      },
      async getStatus() {
        require('settings:read');
        return pusher.status();
      },
      onSyncChanged(listener) {
        return pusher.subscribe(listener);
      },
    },
  };
}
