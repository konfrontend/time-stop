import { and, count, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import { v7 as uuid } from 'uuid';
import { can, newRecord } from '@time-stop/domain';
import type {
  CountRecordsInput,
  DashboardInput,
  ExportReportInput,
  ListRecordsInput,
  Permission,
  Record,
  TimeStopApi,
  TimerListener,
} from '@time-stop/domain';
import type { Identity } from './bootstrap.js';
import { appendChange } from './changes.js';
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
import { readReport } from './report.js';
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
}

export function createSqliteApi(options: SqliteApiOptions): TimeStopApi {
  const { db, installId, actorId, role } = options;
  const now = options.now ?? Date.now;
  const identity: Identity = { installId, actorId, role };
  const listeners = new Set<TimerListener>();

  function require(permission: Permission): void {
    if (!can(role, permission)) throw new Error(`Role ${role} lacks ${permission}`);
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
      return db.transaction((tx) => insertWorkspace(tx, identity, input, now()));
    },
    async updateWorkspace(input) {
      require('workspace:write');
      return db.transaction((tx) => updateWorkspaceRow(tx, identity, input, now()));
    },
    async deleteWorkspace({ id }) {
      require('workspace:write');
      const timerGone = db.transaction((tx) => {
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
      return db.transaction((tx) => insertClient(tx, identity, input, now()));
    },
    async updateClient(input) {
      require('client:write');
      return db.transaction((tx) => updateClientRow(tx, identity, input, now()));
    },
    async deleteClient({ id }) {
      require('client:write');
      db.transaction((tx) => deleteClientRow(tx, identity, id, now()));
    },

    async listProjects(input = {}) {
      require('project:read');
      return listProjectRows(db, input);
    },
    async createProject(input) {
      require('project:write');
      return db.transaction((tx) => insertProject(tx, identity, input, now()));
    },
    async updateProject(input) {
      require('project:write');
      return db.transaction((tx) => updateProjectRow(tx, identity, input, now()));
    },
    async archiveProject({ id }) {
      require('project:write');
      return db.transaction((tx) => {
        clearContextProject(tx, id);
        return setProjectArchived(tx, identity, id, true, now());
      });
    },
    async unarchiveProject({ id }) {
      require('project:write');
      return db.transaction((tx) => setProjectArchived(tx, identity, id, false, now()));
    },
    async deleteProject({ id }) {
      require('project:write');
      const timer = db.transaction((tx) => {
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
      return db.transaction((tx) => writeContext(tx, input));
    },

    async startTimer() {
      require('record:write');
      const record = db.transaction((tx) => {
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
      const stopped = db.transaction((tx) => {
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
      const updated = db.transaction((tx) => patchRecord(tx, identity, id, { name }, now()));
      if (updated.stop === null) notify(updated);
      return updated;
    },

    async createRecord(input) {
      require('record:write');
      return db.transaction((tx) => insertRecord(tx, identity, input, now()));
    },

    async updateRecord(input) {
      require('record:write');
      const { updated, wasTimer } = db.transaction((tx) => ({
        wasTimer: readTimer(tx, actorId)?.id === input.id,
        updated: updateRecordRow(tx, identity, input, now()),
      }));
      if (updated.stop === null) notify(updated);
      else if (wasTimer) notify(null);
      return updated;
    },

    async deleteRecord({ id }) {
      require('record:write');
      const deleted = db.transaction((tx) => deleteRecordRow(tx, identity, id, now()));
      if (deleted.stop === null) notify(null);
    },

    async listRecentNames({ projectId }) {
      require('record:read');
      return listRecentNameRows(db, actorId, projectId, RECENT_NAMES);
    },

    async setRecordBillable({ id, billable }) {
      require('record:write');
      const updated = db.transaction((tx) => patchRecord(tx, identity, id, { billable }, now()));
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
  };
}
