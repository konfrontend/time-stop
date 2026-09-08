import { readFileSync } from 'node:fs';
import { bootstrap, createSqliteApi, openSqlite } from '@time-stop/db';
import { parseCliArgs } from './cliOptions.js';
import { importToggl } from './importToggl.js';
import { parseTogglCsv } from './togglCsv.js';

const { csv, db: path, workspaceName, zone } = parseCliArgs(process.argv.slice(2));
const entries = parseTogglCsv(readFileSync(csv, 'utf8'), { zone });
const db = openSqlite(path);
const { seeded: _seeded, ...identity } = bootstrap(db);
const api = createSqliteApi({ db, ...identity });
const summary = await importToggl(
  api,
  entries,
  workspaceName === undefined ? {} : { workspaceName },
);

console.log(
  `Imported ${summary.records} Records, ${summary.projects} Projects and ${summary.clients} Clients ` +
    `into Workspace ${summary.workspaceId}; ${summary.skipped} entries skipped.`,
);
