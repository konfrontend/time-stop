import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { applyMigrations } from './migrations.js';
import * as schema from './schema.js';

export type SqliteDb = ReturnType<typeof drizzle<typeof schema>>;

export function openSqlite(path: string): SqliteDb {
  const sqlite = new Database(path);
  // Migrations come first so a database written by a newer build is refused before anything, the
  // journal mode included, touches it. WAL is persisted in the file, so this only sets a fresh one.
  applyMigrations(sqlite, path);
  if (path !== ':memory:') sqlite.pragma('journal_mode = WAL');
  return drizzle(sqlite, { schema });
}
