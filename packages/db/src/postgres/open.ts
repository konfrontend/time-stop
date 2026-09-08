import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './schema.js';

export type PostgresDb = ReturnType<typeof drizzle<typeof schema>>;
export type PostgresTx = Parameters<Parameters<PostgresDb['transaction']>[0]>[0];

export async function openPostgres(url: string): Promise<PostgresDb> {
  // The migrator's CREATE IF NOT EXISTS raises a NOTICE on every boot; the CLI must not print it.
  const db = drizzle(postgres(url, { onnotice: () => {} }), { schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../drizzle/postgres', import.meta.url)),
  });
  return db;
}

export async function closePostgres(db: PostgresDb): Promise<void> {
  await db.$client.end();
}
