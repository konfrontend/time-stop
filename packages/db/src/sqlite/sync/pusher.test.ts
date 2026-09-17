import { describe, expect, it, vi } from 'vitest';
import { v7 as uuid } from 'uuid';
import { pushChangesRequestSchema } from '@time-stop/domain';
import type { SyncStatus } from '@time-stop/domain';
import { bootstrap } from '../install/bootstrap.js';
import { upsertEntity } from '../changes.js';
import { openSqlite } from '../open.js';
import { createPusher } from './pusher.js';
import { changes } from '../schema.js';
import { writeServer } from './server.js';

type Reply = { status: number; body?: unknown } | Error;

const NOW = 20_000;

function harness(replies: Reply[] = []) {
  const db = openSqlite(':memory:');
  const identity = bootstrap(db, () => 10_000);
  const sent: Array<{ url: string; token: string; changes: unknown[] }> = [];
  const waits: number[] = [];
  const duringBackoff: SyncStatus[] = [];
  const log = vi.fn();

  const transport = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { changes: unknown[] };
    const token = (new Headers(init?.headers).get('authorization') ?? '').replace('Bearer ', '');
    sent.push({ url: String(input), token, changes: body.changes });
    const reply = replies.shift() ?? { status: 200, body: { inserted: body.changes.length } };
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status });
  });

  const pusher = createPusher({
    db,
    batchSize: 2,
    fetch: transport as unknown as typeof fetch,
    now: () => NOW,
    log,
    wait: async (ms) => {
      waits.push(ms);
      duringBackoff.push(pusher.status());
    },
  });

  function queue(count: number): void {
    for (let index = 0; index < count; index += 1) {
      const at = 11_000 + index;
      db.transaction((tx) =>
        upsertEntity(tx, identity, 'workspace', 'create', {
          id: uuid({ msecs: at }),
          name: `W${index}`,
          currency: null,
          color: '#4f6bd9',
          createdAt: '1970-01-01T00:00:00.001Z',
          updatedAt: new Date(at).toISOString(),
        }),
      );
    }
  }

  return {
    db,
    pusher,
    sent,
    waits,
    duringBackoff,
    log,
    transport,
    queue,
    unsent: () =>
      db
        .select()
        .from(changes)
        .all()
        .filter((row) => row.pushedAt === null).length,
    configure: (token: string) => writeServer(db, { url: 'https://mirror.test', token }),
    async settle(): Promise<void> {
      pusher.kick();
      await pusher.settled();
    },
  };
}

describe('createPusher', () => {
  it('pushes nothing and reports no error while no Server is configured', async () => {
    const h = harness();
    h.queue(3);
    await h.settle();

    expect(h.transport).not.toHaveBeenCalled();
    // The Workspace the bootstrap seeded queues too.
    expect(h.pusher.status()).toMatchObject({
      configured: false,
      halted: false,
      lastError: null,
      pending: 4,
    });
  });

  it('sends unsent Changes in order, in batches, and stamps pushedAt', async () => {
    const h = harness();
    h.queue(3);
    h.configure('tst_one');
    await h.settle();

    expect(h.sent).toHaveLength(2);
    expect(h.sent[0]?.url).toBe('https://mirror.test/changes');
    expect(h.sent[0]?.token).toBe('tst_one');
    for (const push of h.sent) {
      expect(pushChangesRequestSchema.safeParse({ changes: push.changes }).success).toBe(true);
    }
    const order = h.sent
      .flatMap((push) => push.changes as Array<{ updatedAt: string }>)
      .map((change) => change.updatedAt);
    expect(order).toHaveLength(4);
    expect(order).toEqual([...order].sort());

    expect(h.unsent()).toBe(0);
    expect(h.pusher.status()).toMatchObject({
      pending: 0,
      lastPushedAt: '1970-01-01T00:00:20.000Z',
      halted: false,
    });
  });

  it('retries a 5xx and a network failure with exponential backoff and never halts', async () => {
    const h = harness([{ status: 503 }, new TypeError('fetch failed'), { status: 500 }]);
    h.queue(1);
    h.configure('tst_one');
    await h.settle();

    expect(h.waits).toEqual([1000, 2000, 4000]);
    for (const status of h.duringBackoff) {
      expect(status).toMatchObject({ halted: false });
      expect(status.pending).toBeGreaterThan(0);
      expect(status.lastError).toMatchObject({ kind: 'network' });
    }
    expect(h.pusher.status()).toMatchObject({ halted: false, pending: 0, lastError: null });
  });

  it('halts on 401, keeps queueing, and resumes when the Token is replaced', async () => {
    const h = harness([{ status: 401, body: { error: 'Token unknown' } }]);
    h.configure('tst_bad');
    await h.settle();

    expect(h.sent).toHaveLength(1);
    expect(h.waits).toEqual([]);
    expect(h.pusher.status()).toMatchObject({ halted: true, configured: true });
    expect(h.pusher.status().lastError).toMatchObject({
      kind: 'auth',
      at: '1970-01-01T00:00:20.000Z',
    });

    // A halted pusher stays quiet while mutations pile up locally.
    h.queue(2);
    await h.settle();
    expect(h.sent).toHaveLength(1);
    expect(h.pusher.status().pending).toBe(3);

    h.configure('tst_good');
    h.pusher.resume();
    await h.pusher.settled();
    expect(h.pusher.status()).toMatchObject({ halted: false, pending: 0, lastError: null });
    expect(h.sent.at(-1)?.token).toBe('tst_good');
  });

  it('halts on 403 without retrying', async () => {
    const h = harness([{ status: 403 }]);
    h.configure('tst_one');
    await h.settle();

    expect(h.pusher.status()).toMatchObject({ halted: true });
    expect(h.pusher.status().lastError).toMatchObject({ kind: 'auth' });
    expect(h.waits).toEqual([]);
  });

  it('halts on 400 without retrying and logs it as a bug', async () => {
    const h = harness([{ status: 400, body: { error: 'Malformed batch' } }]);
    h.configure('tst_one');
    await h.settle();

    expect(h.pusher.status()).toMatchObject({ halted: true });
    expect(h.pusher.status().lastError).toMatchObject({ kind: 'request' });
    expect(h.waits).toEqual([]);
    expect(h.log).toHaveBeenCalledOnce();
  });

  it('retries any other refusal, a mistyped URL included', async () => {
    const h = harness([{ status: 404 }]);
    h.configure('tst_one');
    await h.settle();

    expect(h.waits).toEqual([1000]);
    expect(h.pusher.status()).toMatchObject({ halted: false, pending: 0 });
  });

  it('keeps reporting the queue while halted, so the Owner sees it grow', async () => {
    const h = harness([{ status: 401 }]);
    const seen: SyncStatus[] = [];
    h.configure('tst_bad');
    await h.settle();
    h.pusher.subscribe((status) => seen.push(status));

    h.queue(2);
    h.pusher.kick();
    expect(seen.at(-1)).toMatchObject({ halted: true, pending: 3 });
  });

  it('picks up a Change committed while a push is in flight', async () => {
    const h = harness();
    h.configure('tst_one');
    h.transport.mockImplementationOnce(async () => {
      // The commit lands while the first batch is still on the wire.
      h.queue(1);
      h.pusher.kick();
      return new Response('{}');
    });
    await h.settle();

    expect(h.unsent()).toBe(0);
  });

  it('notifies subscribers while the push state moves and stops once unsubscribed', async () => {
    const h = harness();
    const seen: SyncStatus[] = [];
    const unsubscribe = h.pusher.subscribe((status) => seen.push(status));
    h.configure('tst_one');
    await h.settle();

    expect(seen.at(-1)).toMatchObject({ pending: 0, configured: true });
    const count = seen.length;
    unsubscribe();
    h.queue(1);
    await h.settle();
    expect(seen).toHaveLength(count);
  });

  it('stays quiet after stop', async () => {
    const h = harness();
    h.configure('tst_one');
    h.pusher.stop();
    await h.settle();

    expect(h.transport).not.toHaveBeenCalled();
  });
});
