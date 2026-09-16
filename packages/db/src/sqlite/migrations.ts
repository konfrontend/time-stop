import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

/** The migrations this build ships; released ones are never edited, only appended to. */
export const SQLITE_MIGRATIONS = fileURLToPath(new URL('../../drizzle/sqlite', import.meta.url));

const BACKUPS_KEPT = 3;
const BACKUP_SUFFIX = '.backup';

/**
 * Raised when the database carries migrations this build does not ship — it was written by a newer
 * Time Stop. The file is left exactly as it was found; the caller tells the user and quits.
 */
export class DatabaseTooNewError extends Error {
  constructor(readonly path: string) {
    super(`${path} was written by a newer version of Time Stop`);
    this.name = 'DatabaseTooNewError';
  }
}

interface JournalEntry {
  when: number;
  tag: string;
}

/** Drizzle stamps each applied migration with its journal entry's `when`, so that is the identity. */
function knownMigrations(folder: string): JournalEntry[] {
  const journal = JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8')) as {
    entries: JournalEntry[];
  };
  return journal.entries;
}

function appliedStamps(sqlite: BetterSqlite3.Database): number[] {
  const table = sqlite
    .prepare(`select 1 from sqlite_master where type = 'table' and name = '__drizzle_migrations'`)
    .get();
  if (!table) return [];
  return sqlite
    .prepare(`select created_at as at from __drizzle_migrations order by created_at`)
    .all()
    .map((row) => Number((row as { at: number }).at));
}

function backupPath(path: string, tag: string): string {
  return join(dirname(path), `${basename(path)}.${tag}${BACKUP_SUFFIX}`);
}

/** Migration tags carry their order, so the newest backups are the last ones by name. */
function rotateBackups(path: string): void {
  const directory = dirname(path);
  const prefix = `${basename(path)}.`;
  readdirSync(directory)
    .filter((name) => name.startsWith(prefix) && name.endsWith(BACKUP_SUFFIX))
    .sort()
    .slice(0, -BACKUPS_KEPT)
    .forEach((stale) => rmSync(join(directory, stale), { force: true }));
}

/**
 * Copies the database aside under the name of the migration it is being upgraded from. `VACUUM
 * INTO` is what makes the copy whole: it folds the WAL in, which copying the file alone would miss.
 */
export function backUpDatabase(sqlite: BetterSqlite3.Database, path: string, tag: string): void {
  const target = backupPath(path, tag);
  // A backup for this migration already stands; it predates whatever half-finished run left it.
  if (existsSync(target)) return;
  sqlite.prepare('VACUUM INTO ?').run(target);
  rotateBackups(path);
}

/**
 * Brings the database up to this build's schema: refuses one written by a newer Time Stop, backs up
 * whatever a pending migration is about to change, then applies what is missing.
 *
 * @throws {DatabaseTooNewError}
 */
export function applyMigrations(
  sqlite: BetterSqlite3.Database,
  path: string,
  folder = SQLITE_MIGRATIONS,
): void {
  const known = knownMigrations(folder);
  const applied = appliedStamps(sqlite);
  const whens = new Set(known.map((entry) => entry.when));

  if (applied.some((stamp) => !whens.has(stamp))) {
    sqlite.close();
    throw new DatabaseTooNewError(path);
  }

  const last = known.find((entry) => entry.when === applied.at(-1));
  // A database with nothing applied yet holds nothing worth keeping.
  if (path !== ':memory:' && last && applied.length < known.length) {
    backUpDatabase(sqlite, path, last.tag);
  }

  migrate(drizzle(sqlite), { migrationsFolder: folder });
}
