import { cpSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  applyMigrations,
  backUpDatabase,
  DatabaseTooNewError,
  SQLITE_MIGRATIONS,
} from './migrations.js';
import { openSqlite } from './open.js';
import { workspaces } from './schema.js';

const AT = '2026-09-01T00:00:00.000Z';
const workspace = { id: 'w', name: 'Default', currency: null, createdAt: AT, updatedAt: AT };

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

const freshPath = (): string =>
  join(mkdtempSync(join(tmpdir(), 'time-stop-migrations-')), 'timestop.sqlite3');

const backups = (path: string): string[] =>
  readdirSync(dirname(path))
    .filter((name) => name.endsWith('.backup'))
    .sort();

const journalOf = (folder: string): { entries: JournalEntry[] } =>
  JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8')) as {
    entries: JournalEntry[];
  };

/** The migrations this build ships, plus one more it would still have to apply. */
function folderWithPendingMigration(): { folder: string; from: string } {
  const folder = join(mkdtempSync(join(tmpdir(), 'time-stop-drizzle-')), 'sqlite');
  cpSync(SQLITE_MIGRATIONS, folder, { recursive: true });
  const journal = journalOf(folder);
  const last = journal.entries.at(-1)!;
  const next = { ...last, idx: last.idx + 1, when: last.when + 1, tag: `${last.tag}_next` };
  journal.entries.push(next);
  writeFileSync(join(folder, 'meta', '_journal.json'), JSON.stringify(journal));
  writeFileSync(join(folder, `${next.tag}.sql`), 'CREATE TABLE next (id text PRIMARY KEY);');
  return { folder, from: last.tag };
}

describe('applyMigrations', () => {
  it('refuses a database holding migrations this build does not know', () => {
    const path = freshPath();
    const stamped = new Database(path);
    applyMigrations(stamped, path);
    stamped
      .prepare('insert into __drizzle_migrations (hash, created_at) values (?, ?)')
      .run('future', 9_999_999_999_999);
    stamped.close();

    expect(() => openSqlite(path)).toThrow(DatabaseTooNewError);
    // The guard runs before anything writes: the row a newer build left is still the only extra one.
    const after = new Database(path);
    expect(after.prepare('select count(*) as n from __drizzle_migrations').get()).toEqual({ n: 2 });
  });

  it('backs the database up before applying a pending migration', () => {
    const path = freshPath();
    openSqlite(path).insert(workspaces).values(workspace).run();
    expect(backups(path)).toEqual([]);

    const { folder, from } = folderWithPendingMigration();
    const sqlite = new Database(path);
    applyMigrations(sqlite, path, folder);

    expect(backups(path)).toEqual([`timestop.sqlite3.${from}.backup`]);
    const backup = new Database(join(dirname(path), backups(path)[0]!), { readonly: true });
    expect(backup.prepare('select id from workspaces').all()).toEqual([{ id: 'w' }]);
    expect(sqlite.prepare("select name from sqlite_master where name = 'next'").get()).toBeTruthy();
  });

  it('makes no backup when nothing is pending', () => {
    const path = freshPath();
    openSqlite(path);
    openSqlite(path);

    expect(backups(path)).toEqual([]);
  });
});

describe('backUpDatabase', () => {
  it('keeps the three newest backups and never overwrites one', () => {
    const path = freshPath();
    openSqlite(path).insert(workspaces).values(workspace).run();
    const sqlite = new Database(path);

    for (const tag of ['0000_a', '0001_b', '0002_c']) backUpDatabase(sqlite, path, tag);
    // A half-finished upgrade relaunches on the same tag; the copy from before it must survive.
    sqlite.prepare('delete from workspaces').run();
    backUpDatabase(sqlite, path, '0002_c');
    backUpDatabase(sqlite, path, '0003_d');

    const kept = new Database(join(dirname(path), 'timestop.sqlite3.0002_c.backup'), {
      readonly: true,
    });
    expect(kept.prepare('select id from workspaces').all()).toEqual([{ id: 'w' }]);
    expect(backups(path)).toEqual([
      'timestop.sqlite3.0001_b.backup',
      'timestop.sqlite3.0002_c.backup',
      'timestop.sqlite3.0003_d.backup',
    ]);
  });
});
