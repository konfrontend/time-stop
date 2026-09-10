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
import { deleteClientRow, insertClient, listClientRows, updateClientRow } from './clients.js';
import { clearContextProject, readContext, writeContext } from './context.js';
import { readDashboard } from './dashboard.js';
import type { SqliteDb } from './open.js';
import {
  deleteProjectRow,
  insertProject,
  listProjectRows,
  setProjectArchived,
  updateProjectRow,
} from './projects.js';
import { createPusher, type Pusher } from './pusher.js';
import { readReport } from './report.js';
import { readServer, writeServer } from './server.js';
import { records } from './schema.js';
import {
  deleteRecordRow,
  insertRecord,
  listRecentNameRows,
  patchRecord,
  readTimer,
  startTimer,
  stopRecord,
  updateRecordRow,
} from './records.js';
import {
  deleteWorkspaceRow,
  insertWorkspace,
  listWorkspaceRows,
  updateWorkspaceRow,
} from './workspaces.js';

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
   * edit or a Billable flip on the running one still notifies; the Context on either id.
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
    async listWorkspaces() {
      require('workspace:read');
      return listWorkspaceRows(db);
    },
    async createWorkspace(input) {
      require('workspace:write');
      return commit((tx) => insertWorkspace(tx, identity, input, now()));
    },
    async updateWorkspace(input) {
      require('workspace:write');
      return commit((tx) => updateWorkspaceRow(tx, identity, input, now()));
    },
    async deleteWorkspace({ id }) {
      require('workspace:write');
      commit((tx) => deleteWorkspaceRow(tx, identity, id, now()));
    },

    async listClients(input = {}) {
      require('client:read');
      return listClientRows(db, input);
    },
    async createClient(input) {
      require('client:write');
      return commit((tx) => insertClient(tx, identity, input, now()));
    },
    async updateClient(input) {
      require('client:write');
      return commit((tx) => updateClientRow(tx, identity, input, now()));
    },
    async deleteClient({ id }) {
      require('client:write');
      commit((tx) => deleteClientRow(tx, identity, id, now()));
    },

    async listProjects(input = {}) {
      require('project:read');
      return listProjectRows(db, input);
    },
    async createProject(input) {
      require('project:write');
      return commit((tx) => insertProject(tx, identity, input, now()));
    },
    async updateProject(input) {
      require('project:write');
      return commit((tx) => updateProjectRow(tx, identity, input, now()));
    },
    async archiveProject({ id }) {
      require('project:write');
      return commit((tx) => {
        clearContextProject(tx, id);
        return setProjectArchived(tx, identity, id, true, now());
      });
    },
    async unarchiveProject({ id }) {
      require('project:write');
      return commit((tx) => setProjectArchived(tx, identity, id, false, now()));
    },
    async deleteProject({ id }) {
      require('project:write');
      commit((tx) => deleteProjectRow(tx, identity, id, now()));
    },

    async countRecords(input: CountRecordsInput) {
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

    async getContext() {
      require('settings:read');
      return readContext(db);
    },
    async setContext(input) {
      require('settings:write');
      return commit((tx) => writeContext(tx, input));
    },

    async startTimer() {
      require('record:write');
      return commit((tx) => startTimer(tx, identity, now()));
    },

    async stopTimer() {
      require('record:write');
      return commit((tx) => {
        const running = readTimer(tx, actorId);
        return running ? stopRecord(tx, identity, running, now()) : null;
      });
    },

    async getTimer() {
      require('record:read');
      return readTimer(db, actorId);
    },

    async updateRecordName({ id, name }) {
      require('record:write');
      return commit((tx) => patchRecord(tx, identity, id, { name }, now()));
    },

    async createRecord(input) {
      require('record:write');
      return commit((tx) => insertRecord(tx, identity, input, now()));
    },

    async updateRecord(input) {
      require('record:write');
      return commit((tx) => updateRecordRow(tx, identity, input, now()));
    },

    async deleteRecord({ id }) {
      require('record:write');
      commit((tx) => deleteRecordRow(tx, identity, id, now()));
    },

    async listRecentNames({ projectId }) {
      require('record:read');
      return listRecentNameRows(db, actorId, projectId, RECENT_NAMES);
    },

    async setRecordBillable({ id, billable }) {
      require('record:write');
      return commit((tx) => patchRecord(tx, identity, id, { billable }, now()));
    },

    async listRecords({ from, to }: ListRecordsInput) {
      require('record:read');
      return db
        .select()
        .from(records)
        .where(and(eq(records.actorId, actorId), gte(records.start, from), lt(records.start, to)))
        .orderBy(desc(records.start))
        .all();
    },

    async getDashboard(input: DashboardInput) {
      require('record:read');
      return readDashboard(db, actorId, input, now());
    },

    async exportReport(input: ExportReportInput) {
      require('record:read');
      return readReport(db, actorId, input, now());
    },

    subscribeTimer(listener) {
      timerListeners.add(listener);
      return () => {
        timerListeners.delete(listener);
      };
    },
    subscribeContext(listener) {
      contextListeners.add(listener);
      return () => {
        contextListeners.delete(listener);
      };
    },

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
    async getSyncStatus() {
      require('settings:read');
      return pusher.status();
    },
    subscribeSync(listener) {
      return pusher.subscribe(listener);
    },
  };
}
