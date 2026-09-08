import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { inject } from 'vitest';
import { closePostgres, openPostgres, type PostgresDb } from '@time-stop/db/postgres';

/** A migrated, empty database of its own, so test files never see each other's rows. */
export async function testDb(): Promise<{ db: PostgresDb; close(): Promise<void> }> {
  const base = new URL(inject('databaseUrl'));
  const name = `test_${randomBytes(6).toString('hex')}`;
  const admin = postgres(base.href);
  await admin.unsafe(`CREATE DATABASE ${name}`);
  await admin.end();
  const url = new URL(base.href);
  url.pathname = `/${name}`;
  const db = await openPostgres(url.href);
  return { db, close: () => closePostgres(db) };
}
