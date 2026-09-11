import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { openSqlite } from './open.js';
import { clients, workspaces } from './schema.js';

const folder = new URL('../../drizzle/sqlite/', import.meta.url);
const AT = '2026-09-01T00:00:00.000Z';

/** A database as the first migration left it, with rows that reference a Workspace. */
function databaseAtInit(): string {
  const path = join(mkdtempSync(join(tmpdir(), 'time-stop-db-')), 'timestop.sqlite3');
  const db = new Database(path);
  const sql = readFileSync(new URL('0000_init.sql', folder), 'utf8');
  db.exec(sql.replaceAll('--> statement-breakpoint', ''));
  const journal = JSON.parse(readFileSync(new URL('meta/_journal.json', folder), 'utf8')) as {
    entries: Array<{ when: number }>;
  };
  db.exec(
    `create table __drizzle_migrations (id integer primary key, hash text not null, created_at numeric);
     insert into __drizzle_migrations (hash, created_at) values ('init', ${journal.entries[0]!.when});
     insert into workspaces values ('w', 'Default', 'USD', '${AT}', '${AT}');
     insert into clients values ('c', 'w', 'Acme', '${AT}');`,
  );
  db.close();
  return path;
}

describe('openSqlite', () => {
  it('migrates a database with referenced Workspaces and keeps foreign keys enforced', () => {
    const db = openSqlite(databaseAtInit());

    expect(db.select().from(workspaces).all()).toEqual([
      {
        id: 'w',
        name: 'Default',
        currency: 'USD',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ]);
    expect(db.select().from(clients).all()).toEqual([
      { id: 'c', workspaceId: 'w', name: 'Acme', updatedAt: '2026-09-01T00:00:00.000Z' },
    ]);
    expect(() =>
      db.insert(clients).values({ id: 'x', workspaceId: 'nope', name: 'n', updatedAt: AT }).run(),
    ).toThrow(/FOREIGN KEY/);
  });
});
