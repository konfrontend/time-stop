import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  bootstrap,
  createPusher,
  createSqliteApi,
  openSqlite,
  stopAbandonedTimer,
} from '@time-stop/db';
import type { Pusher, SqliteDb } from '@time-stop/db';
import type { TimeStopApi } from '@time-stop/domain';

export const DATABASE_FILE = 'timestop.sqlite3';

export interface Database {
  api: TimeStopApi;
  db: SqliteDb;
  pusher: Pusher;
  path: string;
}

export function openDatabase(userData: string): Database {
  mkdirSync(userData, { recursive: true });
  const path = join(userData, DATABASE_FILE);
  const db = openSqlite(path);
  const identity = bootstrap(db);
  stopAbandonedTimer(db, identity);
  const pusher = createPusher({ db });
  return { api: createSqliteApi({ db, ...identity, pusher }), db, pusher, path };
}
