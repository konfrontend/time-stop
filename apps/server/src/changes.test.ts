import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { v7 as uuid } from 'uuid';
import type { Hono } from 'hono';
import type { Client, Project, PushedChange, Record, Workspace } from '@time-stop/domain';
import { mintToken, postgresSchema, revokeToken, type PostgresDb } from '@time-stop/db/postgres';
import { createApp } from './app.js';
import { testDb } from './testDb.js';

let db: PostgresDb;
let app: Hono;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await testDb());
  app = createApp(db);
});
afterAll(() => close());

const install = { installId: uuid(), actorId: uuid() };

function workspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: uuid(),
    name: 'Work',
    currency: 'USD',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

function client(workspaceId: string): Client {
  return { id: uuid(), workspaceId, name: 'Acme', updatedAt: '2026-09-01T10:00:00.000Z' };
}

function project(workspaceId: string, overrides: Partial<Project> = {}): Project {
  return {
    id: uuid(),
    workspaceId,
    clientId: null,
    name: 'Acme API',
    rate: 110,
    limitMin: null,
    limitMax: null,
    limitPeriod: null,
    startDate: null,
    endDate: null,
    color: '#4f6bd9',
    archived: false,
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

function record(workspaceId: string, overrides: Partial<Record> = {}): Record {
  return {
    id: uuid(),
    workspaceId,
    projectId: null,
    actorId: install.actorId,
    name: 'Fix login',
    start: '2026-09-01T09:00:00.000Z',
    stop: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

type Entity = Workspace | Client | Project | Record;

function change(
  entityKind: PushedChange['entityKind'],
  op: PushedChange['op'],
  entity: Entity,
  pair = install,
): PushedChange {
  return {
    id: uuid(),
    entityKind,
    entityId: entity.id,
    op,
    payload: op === 'delete' ? {} : entity,
    updatedAt: entity.updatedAt,
    ...pair,
  };
}

function push(token: string, body: unknown): Promise<Response> {
  return app.request('/changes', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function mint(): Promise<string> {
  return (await mintToken(db)).token;
}

async function workspaceRow(id: string) {
  return db.query.workspaces.findFirst({ where: eq(postgresSchema.workspaces.id, id) });
}

describe('POST /changes', () => {
  it('stores a valid batch, binds the Token and materializes the entities', async () => {
    const token = await mint();
    const ws = workspace();
    const cl = client(ws.id);
    const p = project(ws.id, { clientId: cl.id });
    const r = record(ws.id, { projectId: p.id });
    const batch = [
      change('workspace', 'create', ws),
      change('client', 'create', cl),
      change('project', 'create', p),
      change('record', 'create', r),
    ];

    const res = await push(token, { changes: batch });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ inserted: 4 });

    expect(await workspaceRow(ws.id)).toEqual(ws);
    expect(
      await db.query.clients.findFirst({ where: eq(postgresSchema.clients.id, cl.id) }),
    ).toEqual(cl);
    expect(
      await db.query.projects.findFirst({ where: eq(postgresSchema.projects.id, p.id) }),
    ).toEqual(p);
    expect(
      await db.query.records.findFirst({ where: eq(postgresSchema.records.id, r.id) }),
    ).toEqual(r);
    const stored = await db.query.changes.findMany();
    expect(stored.map((c) => c.id).sort()).toEqual(batch.map((c) => c.id).sort());

    const bound = await db.query.tokens.findFirst();
    expect(bound).toMatchObject(install);
  });

  it('reposting the same batch changes nothing', async () => {
    const token = await mint();
    const ws = workspace();
    const batch = { changes: [change('workspace', 'create', ws)] };
    await push(token, batch);
    const before = await db.query.changes.findMany();

    const res = await push(token, batch);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ inserted: 0 });
    expect(await db.query.changes.findMany()).toEqual(before);
    expect(await workspaceRow(ws.id)).toEqual(ws);
  });

  it('materializes create, update and delete in sequence', async () => {
    const token = await mint();
    const ws = workspace();
    const renamed = { ...ws, name: 'Play', updatedAt: '2026-09-01T11:00:00.000Z' };
    const gone = { ...ws, updatedAt: '2026-09-01T12:00:00.000Z' };

    await push(token, { changes: [change('workspace', 'create', ws)] });
    await push(token, { changes: [change('workspace', 'update', renamed)] });
    expect(await workspaceRow(ws.id)).toEqual(renamed);

    await push(token, { changes: [change('workspace', 'delete', gone)] });
    expect(await workspaceRow(ws.id)).toBeUndefined();
    const log = await db.query.changes.findMany({
      where: eq(postgresSchema.changes.entityId, ws.id),
    });
    expect(log).toHaveLength(3);
  });

  it('never lets an older updatedAt overwrite a newer row', async () => {
    const token = await mint();
    const ws = workspace({ updatedAt: '2026-09-01T11:00:00.000Z' });
    const stale = { ...ws, name: 'Old', updatedAt: '2026-09-01T10:00:00.000Z' };

    await push(token, { changes: [change('workspace', 'create', ws)] });
    const res = await push(token, { changes: [change('workspace', 'update', stale)] });
    expect(res.status).toBe(200);
    expect(await workspaceRow(ws.id)).toEqual(ws);
  });

  it('rejects an unknown or revoked Token with 401', async () => {
    const ws = workspace();
    const batch = { changes: [change('workspace', 'create', ws)] };
    expect((await push('tst_nope', batch)).status).toBe(401);
    expect((await app.request('/changes', { method: 'POST' })).status).toBe(401);

    const { id, token } = await mintToken(db);
    await revokeToken(db, id);
    expect((await push(token, batch)).status).toBe(401);
    expect(await workspaceRow(ws.id)).toBeUndefined();
  });

  it('rejects a bound Token presented by another Install or Actor with 403', async () => {
    const token = await mint();
    await push(token, { changes: [change('workspace', 'create', workspace())] });

    const otherInstall = { installId: uuid(), actorId: install.actorId };
    const otherActor = { installId: install.installId, actorId: uuid() };
    for (const pair of [otherInstall, otherActor]) {
      const ws = workspace();
      const res = await push(token, { changes: [change('workspace', 'create', ws, pair)] });
      expect(res.status).toBe(403);
      expect(await workspaceRow(ws.id)).toBeUndefined();
    }
  });

  it('rejects a malformed batch with 400 and writes nothing', async () => {
    const { id, token } = await mintToken(db);
    const ws = workspace();
    const good = change('workspace', 'create', ws);
    const bad = { ...change('record', 'create', record(ws.id)), payload: { id: 'nope' } };

    const res = await push(token, { changes: [good, bad] });
    expect(res.status).toBe(400);
    expect(await workspaceRow(ws.id)).toBeUndefined();
    expect(
      await db.query.changes.findFirst({ where: eq(postgresSchema.changes.id, good.id) }),
    ).toBeUndefined();

    expect((await push(token, '{not json')).status).toBe(400);
    expect((await push(token, { changes: [] })).status).toBe(400);
    const [minted] = await db
      .select()
      .from(postgresSchema.tokens)
      .where(eq(postgresSchema.tokens.id, id));
    expect(minted?.installId).toBeNull();
  });
});

describe('GET /health', () => {
  it('returns 200 with an ok status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
