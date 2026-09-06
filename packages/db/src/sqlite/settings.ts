import { eq } from 'drizzle-orm';
import type { Tx } from './changes.js';
import type { SqliteDb } from './open.js';
import { settings } from './schema.js';

export function readSetting(db: Tx | SqliteDb, key: string): string | null {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
}

export function writeSetting(tx: Tx | SqliteDb, key: string, value: string | null): void {
  if (value === null) {
    tx.delete(settings).where(eq(settings.key, key)).run();
  } else {
    tx.insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
      .run();
  }
}
