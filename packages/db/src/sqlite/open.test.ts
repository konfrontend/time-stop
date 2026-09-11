import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { openSqlite } from './open.js';
import { changes, clients, records, workspaces } from './schema.js';

const folder = new URL('../../drizzle/sqlite/', import.meta.url);
const AT = '2026-09-01T00:00:00.000Z';
const AT_MS = Date.parse('2026-09-01T00:00:00.007Z');

/** A database as the first migration left it, with epoch-ms rows that reference a Workspace. */
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
     insert into workspaces values ('w', 'Default', 'USD', ${AT_MS}, ${AT_MS});
     insert into clients values ('c', 'w', 'Acme', ${AT_MS});
     insert into records (id, workspace_id, actor_id, start, stop, updated_at)
       values ('r', 'w', 'a', ${AT_MS}, null, ${AT_MS});
     insert into changes values ('ch', 'record', 'r', 'create',
       '{"id":"r","start":${AT_MS},"stop":null,"updatedAt":${AT_MS}}', ${AT_MS}, 'a', 'i', null);`,
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
        createdAt: '2026-09-01T00:00:00.007Z',
        updatedAt: '2026-09-01T00:00:00.007Z',
      },
    ]);
    expect(db.select().from(clients).all()).toEqual([
      { id: 'c', workspaceId: 'w', name: 'Acme', updatedAt: '2026-09-01T00:00:00.007Z' },
    ]);
    expect(() =>
      db.insert(clients).values({ id: 'x', workspaceId: 'nope', name: 'n', updatedAt: AT }).run(),
    ).toThrow(/FOREIGN KEY/);
  });

  it('rewrites epoch-ms timestamps as ISO 8601 text, including pending Change payloads', () => {
    const db = openSqlite(databaseAtInit());

    expect(db.select().from(records).get()).toMatchObject({
      start: '2026-09-01T00:00:00.007Z',
      stop: null,
      updatedAt: '2026-09-01T00:00:00.007Z',
    });
    expect(db.select().from(changes).get()).toMatchObject({
      payload: {
        id: 'r',
        start: '2026-09-01T00:00:00.007Z',
        stop: null,
        updatedAt: '2026-09-01T00:00:00.007Z',
      },
      updatedAt: '2026-09-01T00:00:00.007Z',
      pushedAt: null,
    });
  });
});
