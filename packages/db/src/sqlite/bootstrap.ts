import { eq } from 'drizzle-orm';
import { v7 as uuid } from 'uuid';
import { roleSchema } from '@time-stop/domain';
import type { Role } from '@time-stop/domain';
import type { SqliteDb } from './open.js';
import { settings, workspaces } from './schema.js';
import { appendChange } from './changes.js';

export interface Identity {
  installId: string;
  actorId: string;
  role: Role;
}

export interface BootstrapResult extends Identity {
  seeded: boolean;
}

export const DEFAULT_WORKSPACE = { name: 'Default', currency: 'USD' } as const;

function readSetting(db: SqliteDb, key: string): string | null {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
}

export function bootstrap(db: SqliteDb, now: () => number = Date.now): BootstrapResult {
  const existingInstall = readSetting(db, 'installId');
  const existingActor = readSetting(db, 'actorId');
  const existingRole = readSetting(db, 'actorRole');
  if (existingInstall && existingActor && existingRole) {
    return {
      installId: existingInstall,
      actorId: existingActor,
      role: roleSchema.parse(existingRole),
      seeded: false,
    };
  }

  return db.transaction((tx) => {
    const at = now();
    const identity: Identity = {
      installId: uuid({ msecs: at }),
      actorId: uuid({ msecs: at }),
      role: 'owner',
    };
    tx.insert(settings)
      .values([
        { key: 'installId', value: identity.installId },
        { key: 'actorId', value: identity.actorId },
        { key: 'actorRole', value: identity.role },
      ])
      .run();
    const workspace = {
      id: uuid({ msecs: at }),
      ...DEFAULT_WORKSPACE,
      createdAt: at,
      updatedAt: at,
    };
    tx.insert(workspaces).values(workspace).run();
    appendChange(tx, identity, { entityKind: 'workspace', op: 'create', entity: workspace });
    return { ...identity, seeded: true };
  });
}
