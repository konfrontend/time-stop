import { eq } from 'drizzle-orm';
import { uuidv7 } from '@time-stop/domain';
import type { SqliteDb } from './open.js';
import { settings, workspaces } from './schema.js';
import { appendChange } from './changes.js';

export interface Identity {
  installId: string;
  actorId: string;
}

export interface BootstrapResult extends Identity {
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
  if (existingInstall && existingActor) {
    return { installId: existingInstall, actorId: existingActor, seeded: false };
  }

  return db.transaction((tx) => {
    const at = now();
    const identity: Identity = { installId: uuidv7(at), actorId: uuidv7(at) };
    tx.insert(settings)
      .values([
        { key: 'installId', value: identity.installId },
        { key: 'actorId', value: identity.actorId },
      ])
      .run();
    const workspace = { id: uuidv7(at), ...DEFAULT_WORKSPACE, createdAt: at, updatedAt: at };
    tx.insert(workspaces).values(workspace).run();
    appendChange(tx, identity, { entityKind: 'workspace', op: 'create', entity: workspace });
    return { ...identity, seeded: true };
  });
}
