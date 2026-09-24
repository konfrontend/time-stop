import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openSqlite } from './open.js';
import { clients, workspaces } from './schema.js';

const AT = '2026-09-01T00:00:00.000Z';
const workspace = {
  id: 'w',
  name: 'Default',
  currency: null,
  color: '#4f6bd9',
  createdAt: AT,
  updatedAt: AT,
};

const freshPath = () => join(mkdtempSync(join(tmpdir(), 'db-')), 'local.sqlite3');

describe('openSqlite', () => {
  it('migrates a fresh database and enforces foreign keys', () => {
    const db = openSqlite(freshPath());

    db.insert(workspaces).values(workspace).run();
    db.insert(clients).values({ id: 'c', workspaceId: 'w', name: 'Acme', updatedAt: AT }).run();

    expect(db.select().from(clients).all()).toEqual([
      { id: 'c', workspaceId: 'w', name: 'Acme', updatedAt: AT },
    ]);
    expect(() =>
      db.insert(clients).values({ id: 'x', workspaceId: 'nope', name: 'n', updatedAt: AT }).run(),
    ).toThrow(/FOREIGN KEY/);
  });

  it('reopens a migrated database and keeps its rows', () => {
    const path = freshPath();
    openSqlite(path).insert(workspaces).values(workspace).run();

    expect(openSqlite(path).select().from(workspaces).all()).toEqual([workspace]);
  });
});
