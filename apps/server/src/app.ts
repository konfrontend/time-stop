import { Hono } from 'hono';
import { pushChangesRequestSchema } from '@time-stop/domain';
import type { PushChangesResponse } from '@time-stop/domain';
import { findToken, ingestChanges, TokenError } from '@time-stop/db/postgres';
import type { PostgresDb, TokenRejection } from '@time-stop/db/postgres';

const statusOf: Record<TokenRejection, 401 | 403> = { unknown: 401, revoked: 401, mismatch: 403 };

export function createApp(db: PostgresDb): Hono {
  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.onError((error, c) => {
    if (error instanceof TokenError)
      return c.json({ error: error.message }, statusOf[error.reason]);
    console.error(error);
    return c.json({ error: 'Internal error' }, 500);
  });

  app.post('/changes', async (c) => {
    const bearer = c.req.header('authorization')?.match(/^Bearer (.+)$/);
    if (!bearer) return c.json({ error: 'Token missing' }, 401);
    const token = await findToken(db, bearer[1]!);

    const body = await c.req.json().catch(() => undefined);
    const batch = pushChangesRequestSchema.safeParse(body);
    if (!batch.success)
      return c.json({ error: 'Malformed batch', issues: batch.error.issues }, 400);

    const result: PushChangesResponse = await ingestChanges(db, token.id, batch.data.changes);
    return c.json(result);
  });

  return app;
}
