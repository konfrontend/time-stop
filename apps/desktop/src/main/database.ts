import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { bootstrap, createSqliteApi, openSqlite, stopAbandonedTimer } from '@time-stop/db';
import type { SqliteDb } from '@time-stop/db';
import type { TimeStopApi } from '@time-stop/domain';

export const DATABASE_FILE = 'timestop.sqlite3';

export function openDatabase(userData: string): { api: TimeStopApi; db: SqliteDb; path: string } {
  mkdirSync(userData, { recursive: true });
  const path = join(userData, DATABASE_FILE);
  const db = openSqlite(path);
  const identity = bootstrap(db);
  stopAbandonedTimer(db, identity);
  return { api: createSqliteApi({ db, ...identity }), db, path };
}
