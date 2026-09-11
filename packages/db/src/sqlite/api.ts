import { can } from '@time-stop/domain';
import type {
  Context,
  ContextListener,
  Permission,
  Record,
  TimeStopApi,
  TimerListener,
} from '@time-stop/domain';
import type { ApiContext } from './ApiContext.js';
import type { Tx } from './changes.js';
import { clientApi } from './client/api.js';
import { readContext } from './context/rows.js';
import { contextApi } from './context/api.js';
import { dashboardApi } from './dashboard/api.js';
import type { Identity } from './install/Identity.js';
import type { SqliteDb } from './open.js';
import { projectApi } from './project/api.js';
import { recordApi } from './record/api.js';
import { readTimer } from './record/rows.js';
import { reportApi } from './report/api.js';
import { syncApi } from './sync/api.js';
import { createPusher, type Pusher } from './sync/pusher.js';
import { workspaceApi } from './workspace/api.js';

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

/** Assembles one group per concept over a shared context, the way the domain assembles the contract. */
export function createSqliteApi(options: SqliteApiOptions): TimeStopApi {
  const { db, installId, actorId, role } = options;
  const now = options.now ?? Date.now;
  const timestamp = () => new Date(now()).toISOString();
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

  const context: ApiContext = { db, identity, now, timestamp, pusher, commit, require };
  return {
    workspace: workspaceApi(context),
    client: clientApi(context),
    project: projectApi(context),
    record: recordApi(context, timerListeners),
    context: contextApi(context, contextListeners),
    dashboard: dashboardApi(context),
    report: reportApi(context),
    sync: syncApi(context),
  };
}
