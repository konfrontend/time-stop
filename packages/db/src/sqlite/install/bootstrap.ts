import { v7 as uuid } from 'uuid';
import { DEFAULT_COLOR, roleSchema } from '@app/domain';
import type { SqliteDb } from '../open.js';
import { settings } from '../schema.js';
import { readSetting } from '../settings.js';
import { upsertEntity } from '../changes.js';
import type { Identity } from './Identity.js';

export interface BootstrapResult extends Identity {
  seeded: boolean;
}

export const DEFAULT_WORKSPACE = { name: 'Default', currency: null, color: DEFAULT_COLOR } as const;
export const DEFAULT_WORKSPACE_KEY = 'defaultWorkspaceId';

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
    const stamped = new Date(at).toISOString();
    const identity: Identity = {
      installId: uuid({ msecs: at }),
      actorId: uuid({ msecs: at }),
      role: 'owner',
    };
    const workspace = {
      id: uuid({ msecs: at }),
      ...DEFAULT_WORKSPACE,
      createdAt: stamped,
      updatedAt: stamped,
    };
    tx.insert(settings)
      .values([
        { key: 'installId', value: identity.installId },
        { key: 'actorId', value: identity.actorId },
        { key: 'actorRole', value: identity.role },
        { key: DEFAULT_WORKSPACE_KEY, value: workspace.id },
      ])
      .run();
    upsertEntity(tx, identity, 'workspace', 'create', workspace);
    return { ...identity, seeded: true };
  });
}
