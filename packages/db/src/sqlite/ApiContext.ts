import type { Permission } from '@time-stop/domain';
import type { Tx } from './changes.js';
import type { Identity } from './install/Identity.js';
import type { SqliteDb } from './open.js';
import type { Pusher } from './sync/pusher.js';

/** What every concept's api group is built over. */
export interface ApiContext {
  db: SqliteDb;
  identity: Identity;
  now: () => number;
  pusher: Pusher;
  /** Runs one write transaction; publishes whatever it moved and wakes the Pusher. */
  commit<T>(write: (tx: Tx) => T): T;
  /** Throws unless the Role holds the Permission. */
  require(permission: Permission): void;
}
