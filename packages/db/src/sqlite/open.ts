import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';

export type SqliteDb = ReturnType<typeof drizzle<typeof schema>>;

export function openSqlite(path: string): SqliteDb {
  const sqlite = new Database(path);
  if (path !== ':memory:') sqlite.pragma('journal_mode = WAL');
  const db = drizzle(sqlite, { schema });
  // SQLite rebuilds a table to alter it; the migrator's transaction cannot toggle the pragma.
  sqlite.pragma('foreign_keys = OFF');
  migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../drizzle/sqlite', import.meta.url)),
  });
  sqlite.pragma('foreign_keys = ON');
  const violations = sqlite.pragma('foreign_key_check') as unknown[];
  if (violations.length > 0)
    throw new Error(`Migration left ${violations.length} broken references`);
  return db;
}
