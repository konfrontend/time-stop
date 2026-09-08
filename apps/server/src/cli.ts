import { closePostgres, openPostgres } from '@time-stop/db/postgres';
import { databaseUrl } from './env.js';
import { runTokenCli } from './tokenCli.js';

const db = await openPostgres(databaseUrl());
try {
  await runTokenCli(process.argv.slice(2), db, console.log);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closePostgres(db);
}
