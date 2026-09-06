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
}

/** Who this Install acts as: the single Actor and the Role it holds. */
export interface Principal extends Identity {
  role: Role;
}

export interface BootstrapResult extends Principal {
  /** True when this call created the identity and the default Workspace. */
  seeded: boolean;
}

export const DEFAULT_WORKSPACE = { name: 'Default', currency: 'USD' } as const;

function readSetting(db: SqliteDb, key: string): string | null {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
}

/**
 * First launch mints the Install id and Actor id and seeds one default Workspace, all in one
 * transaction; later launches find them and seed nothing.
 */
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
    const principal: Principal = {
      installId: uuid({ msecs: at }),
      actorId: uuid({ msecs: at }),
      role: 'owner',
    };
    tx.insert(settings)
      .values([
        { key: 'installId', value: principal.installId },
        { key: 'actorId', value: principal.actorId },
        { key: 'actorRole', value: principal.role },
      ])
      .run();
    const workspace = {
      id: uuid({ msecs: at }),
      ...DEFAULT_WORKSPACE,
      createdAt: at,
      updatedAt: at,
    };
    tx.insert(workspaces).values(workspace).run();
    appendChange(tx, principal, { entityKind: 'workspace', op: 'create', entity: workspace });
    return { ...principal, seeded: true };
  });
}
