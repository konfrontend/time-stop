import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TimeStopApi } from '@time-stop/domain';
import { createSqliteApi } from './api.js';
import { bootstrap } from './bootstrap.js';
import { openSqlite } from './open.js';
import { createPusher, type Pusher } from './pusher.js';
import { stopAbandonedTimer } from './records.js';
import { readSetting, writeSetting } from './settings.js';

const ALWAYS_ON_TOP_KEY = 'windowAlwaysOnTop';

/** Window preferences of the Install, kept in the settings table beside its identity. */
export interface Preferences {
  isAlwaysOnTop(): boolean;
  setAlwaysOnTop(value: boolean): void;
}

export interface LocalStore {
  api: TimeStopApi;
  /** The mirror to the Server; the caller kicks it at launch and stops it at quit. */
  pusher: Pusher;
  preferences: Preferences;
  path: string;
}

/**
 * The Install's database, ready to use: migrated, bootstrapped with its identity and default
 * Workspace, any Timer the previous session abandoned stopped, and the Pusher built over it.
 * `:memory:` opens a throwaway store.
 */
export function openLocalStore(path: string): LocalStore {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = openSqlite(path);
  const identity = bootstrap(db);
  stopAbandonedTimer(db, identity);
  const pusher = createPusher({ db });
  return {
    api: createSqliteApi({ db, ...identity, pusher }),
    pusher,
    preferences: {
      isAlwaysOnTop: () => readSetting(db, ALWAYS_ON_TOP_KEY) === 'true',
      setAlwaysOnTop: (value) => writeSetting(db, ALWAYS_ON_TOP_KEY, String(value)),
    },
    path,
  };
}
