import { serve } from '@hono/node-server';
import { openPostgres } from '@time-stop/db/postgres';
import { createApp } from './app.js';
import { databaseUrl } from './env.js';

const port = Number(process.env['PORT'] ?? 3000);
const db = await openPostgres(databaseUrl());

serve({ fetch: createApp(db).fetch, port }, (info) => {
  console.log(`Time Stop server listening on http://localhost:${info.port}`);
});
