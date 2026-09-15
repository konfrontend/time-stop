import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TimeStopApi } from '@time-stop/domain';
import { createSqliteApi } from './api.js';
import { seedContextProject } from './context/rows.js';
import { bootstrap } from './install/bootstrap.js';
import { preferencesOf, type Preferences } from './install/Preferences.js';
import { openSqlite } from './open.js';
import { createPusher, type Pusher } from './sync/pusher.js';
import { stopAbandonedTimer } from './record/rows.js';

export interface LocalStore {
  api: TimeStopApi;
  /** The mirror to the Server; the caller kicks it at launch and stops it at quit. */
  pusher: Pusher;
  preferences: Preferences;
  path: string;
}

/**
 * The Install's database, ready to use: migrated, bootstrapped with its identity and default
 * Workspace, any Timer the previous session abandoned stopped, an empty Context Project seeded
 * from the latest Record, and the Pusher built over it.
 * `:memory:` opens a throwaway store.
 */
export function openLocalStore(path: string): LocalStore {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = openSqlite(path);
  const identity = bootstrap(db);
  stopAbandonedTimer(db, identity);
  seedContextProject(db, identity.actorId);
  const pusher = createPusher({ db });
  return {
    api: createSqliteApi({ db, ...identity, pusher }),
    pusher,
    preferences: preferencesOf(db),
    path,
  };
}
