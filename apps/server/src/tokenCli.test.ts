import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { v7 as uuid } from 'uuid';
import type { Hono } from 'hono';
import type { PostgresDb } from '@time-stop/db/postgres';
import { createApp } from './app.js';
import { runTokenCli } from './tokenCli.js';
import { testDb } from './testDb.js';

let db: PostgresDb;
let app: Hono;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await testDb());
  app = createApp(db);
});
afterAll(() => close());

async function cli(...args: string[]): Promise<string[]> {
  const lines: string[] = [];
  await runTokenCli(args, db, (line) => lines.push(line));
  return lines;
}

function push(token: string): Promise<Response> {
  const workspace = { id: uuid(), name: 'Work', currency: null, createdAt: 1, updatedAt: 1 };
  return app.request('/changes', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      changes: [
        {
          id: uuid(),
          entityKind: 'workspace',
          entityId: workspace.id,
          op: 'create',
          payload: workspace,
          updatedAt: 1,
          actorId: uuid(),
          installId: uuid(),
        },
      ],
    }),
  });
}

describe('token CLI', () => {
  it('mint prints the Token once and stores only its hash', async () => {
    const output = await cli('mint');
    const token = output.join('\n').match(/tst_[A-Za-z0-9_-]{43}/)?.[0];
    expect(token).toBeDefined();

    const rows = await db.query.tokens.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toBe(createHash('sha256').update(token!).digest('hex'));
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows[0]).toMatchObject({ installId: null, actorId: null, revokedAt: null });

    expect((await push(token!)).status).toBe(200);
  });

  it('revoke marks the Token revoked so the Server refuses it', async () => {
    const output = await cli('mint');
    const token = output.join('\n').match(/tst_[A-Za-z0-9_-]{43}/)![0];
    const id = output.join('\n').match(/[0-9a-f-]{36}/)![0];

    await cli('revoke', id);
    const row = await db.query.tokens.findFirst({
      where: (t, { eq }) => eq(t.id, id),
    });
    expect(row?.revokedAt).not.toBeNull();
    expect((await push(token)).status).toBe(401);
  });

  it('revoke of an unknown or already revoked id fails', async () => {
    await expect(cli('revoke', uuid())).rejects.toThrow(/not found or already revoked/);
  });
});
