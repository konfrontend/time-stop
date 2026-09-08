import { and, count, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import { v7 as uuid } from 'uuid';
import { can, newRecord, serverInputSchema } from '@time-stop/domain';
import type {
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
import { appendChange, type Tx } from './changes.js';
import { deleteClientRow, insertClient, listClientRows, updateClientRow } from './clients.js';
import { clearContextProject, readContext, writeContext } from './context.js';
import { readDashboard } from './dashboard.js';
import type { SqliteDb } from './open.js';
import {
  deleteProjectRow,
  insertProject,
  listProjectRows,
  readProject,
  setProjectArchived,
  updateProjectRow,
} from './projects.js';
import { createPusher, type Pusher } from './pusher.js';
import { readReport } from './report.js';
import { readServer, writeServer } from './server.js';
import { clients, projects, records } from './schema.js';
import {
  deleteRecordRow,
  insertRecord,
  listRecentNameRows,
  patchRecord,
  updateRecordRow,
} from './records.js';
import { readTimer, stopRecord } from './timer.js';
import {
  deleteWorkspaceRow,
  insertWorkspace,
  listWorkspaceRows,
  readWorkspace,
  updateWorkspaceRow,
} from './workspaces.js';

const RECENT_NAMES = 10;

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
  const listeners = new Set<TimerListener>();
  const pusher = options.pusher ?? createPusher({ db, now });

  /** Every write goes through here, so the pusher wakes as soon as the Change has landed. */
  function commit<T>(write: (tx: Tx) => T): T {
    const result = db.transaction(write);
    pusher.kick();
    return result;
  }

  function require(permission: Permission): void {
    if (!can(role, permission)) throw new Error(`Role ${role} lacks ${permission}`);
  }

  function server(): ServerSettings {
    const { url, token } = readServer(db);
    return { url, tokenSet: token !== null, databasePath: db.$client.name };
  }

  function notify(timer: Record | null): void {
    for (const listener of listeners) listener(timer);
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
      const timerGone = commit((tx) => {
        const at = now();
        readWorkspace(tx, id);
        const running = readTimer(tx, actorId);
        // Everything the Workspace contains goes with it, each as its own Change.
        for (const record of tx.select().from(records).where(eq(records.workspaceId, id)).all()) {
          tx.delete(records).where(eq(records.id, record.id)).run();
          appendChange(tx, identity, {
            entityKind: 'record',
            op: 'delete',
            entity: { id: record.id, updatedAt: at },
          });
        }
        for (const project of tx
          .select()
          .from(projects)
          .where(eq(projects.workspaceId, id))
          .all()) {
          deleteProjectRow(tx, identity, project.id, at);
        }
        for (const client of tx.select().from(clients).where(eq(clients.workspaceId, id)).all()) {
          deleteClientRow(tx, identity, client.id, at);
        }
        deleteWorkspaceRow(tx, identity, id, at);
        return running?.workspaceId === id;
      });
      if (timerGone) notify(null);
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
      const timer = commit((tx) => {
        const running = readTimer(tx, actorId);
        deleteProjectRow(tx, identity, id, now());
        return running?.projectId === id ? readTimer(tx, actorId) : null;
      });
      if (timer) notify(timer);
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
      const record = commit((tx) => {
        const at = now();
        const running = readTimer(tx, actorId);
        if (running) stopRecord(tx, identity, running, at);
        const context = readContext(tx);
        const record = newRecord({
          id: uuid({ msecs: at }),
          actorId,
          workspaceId: context.workspaceId,
          project: context.projectId ? readProject(tx, context.projectId) : null,
          start: at,
          now: at,
        });
        tx.insert(records).values(record).run();
        appendChange(tx, identity, { entityKind: 'record', op: 'create', entity: record });
        return record;
      });
      notify(record);
      return record;
    },

    async stopTimer() {
      require('record:write');
      const stopped = commit((tx) => {
        const running = readTimer(tx, actorId);
        return running ? stopRecord(tx, identity, running, now()) : null;
      });
      if (stopped) notify(null);
      return stopped;
    },

    async getTimer() {
      require('record:read');
      return readTimer(db, actorId);
    },

    async updateRecordName({ id, name }) {
      require('record:write');
      const updated = commit((tx) => patchRecord(tx, identity, id, { name }, now()));
      if (updated.stop === null) notify(updated);
      return updated;
    },

    async createRecord(input) {
      require('record:write');
      return commit((tx) => insertRecord(tx, identity, input, now()));
    },

    async updateRecord(input) {
      require('record:write');
      const { updated, wasTimer } = commit((tx) => ({
        wasTimer: readTimer(tx, actorId)?.id === input.id,
        updated: updateRecordRow(tx, identity, input, now()),
      }));
      if (updated.stop === null) notify(updated);
      else if (wasTimer) notify(null);
      return updated;
    },

    async deleteRecord({ id }) {
      require('record:write');
      const deleted = commit((tx) => deleteRecordRow(tx, identity, id, now()));
      if (deleted.stop === null) notify(null);
    },

    async listRecentNames({ projectId }) {
      require('record:read');
      return listRecentNameRows(db, actorId, projectId, RECENT_NAMES);
    },

    async setRecordBillable({ id, billable }) {
      require('record:write');
      const updated = commit((tx) => patchRecord(tx, identity, id, { billable }, now()));
      if (updated.stop === null) notify(updated);
      return updated;
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
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
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
