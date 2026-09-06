import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { bootstrap, DEFAULT_WORKSPACE } from './bootstrap.js';
import { openSqlite } from './open.js';
import { changes, settings, workspaces } from './schema.js';

describe('bootstrap', () => {
  it('first launch seeds one default Workspace, an installId and an actorId', () => {
    const db = openSqlite(':memory:');
    const first = bootstrap(db, () => 1_000);

    expect(first.seeded).toBe(true);
    expect(first.role).toBe('owner');
    expect(first.installId).not.toBe(first.actorId);
    expect(db.select().from(settings).all()).toEqual(
      expect.arrayContaining([
        { key: 'installId', value: first.installId },
        { key: 'actorId', value: first.actorId },
        { key: 'actorRole', value: 'owner' },
        { key: 'defaultWorkspaceId', value: db.select().from(workspaces).get()!.id },
      ]),
    );
    expect(db.select().from(workspaces).all()).toEqual([
      expect.objectContaining({ ...DEFAULT_WORKSPACE, createdAt: 1_000, updatedAt: 1_000 }),
    ]);
    expect(db.select().from(changes).all()).toEqual([
      expect.objectContaining({
        entityKind: 'workspace',
        op: 'create',
        actorId: first.actorId,
        installId: first.installId,
        pushedAt: null,
      }),
    ]);
  });

  it('second launch finds the identity and seeds nothing', () => {
    const db = openSqlite(':memory:');
    const first = bootstrap(db, () => 1_000);
    const second = bootstrap(db, () => 2_000);

    expect(second).toEqual({
      installId: first.installId,
      actorId: first.actorId,
      role: 'owner',
      seeded: false,
    });
    expect(db.select().from(workspaces).all()).toHaveLength(1);
    expect(db.select().from(changes).all()).toHaveLength(1);
  });

  it('backfills the default Workspace key on a database from before it existed', () => {
    const db = openSqlite(':memory:');
    const first = bootstrap(db, () => 1_000);
    db.delete(settings).where(eq(settings.key, 'defaultWorkspaceId')).run();

    bootstrap(db, () => 2_000);

    expect(bootstrap(db, () => 3_000).installId).toBe(first.installId);
    expect(db.select().from(settings).where(eq(settings.key, 'defaultWorkspaceId')).get()).toEqual({
      key: 'defaultWorkspaceId',
      value: db.select().from(workspaces).get()!.id,
    });
  });
});
