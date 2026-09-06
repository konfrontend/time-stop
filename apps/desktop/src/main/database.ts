import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { bootstrap, createSqliteApi, openSqlite } from '@time-stop/db';
import type { TimeStopApi } from '@time-stop/domain';

export const DATABASE_FILE = 'timestop.sqlite3';

/** Opens (creating and migrating as needed) the SQLite file in `userData` and seeds first launch. */
export function openDatabase(userData: string): { api: TimeStopApi; path: string } {
  mkdirSync(userData, { recursive: true });
  const path = join(userData, DATABASE_FILE);
  const db = openSqlite(path);
  const { installId, actorId } = bootstrap(db);
  return { api: createSqliteApi({ db, installId, actorId }), path };
}
