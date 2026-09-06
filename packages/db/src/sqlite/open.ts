import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';

export type SqliteDb = ReturnType<typeof drizzle<typeof schema>>;

export function openSqlite(path: string): SqliteDb {
  const sqlite = new Database(path);
  if (path !== ':memory:') sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../drizzle/sqlite', import.meta.url)),
  });
  return db;
}
