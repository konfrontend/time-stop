import { count, inArray, isNull, max, sql } from 'drizzle-orm';
import type { SyncError, SyncListener, SyncStatus } from '@app/domain';
import type { SqliteDb } from '../open.js';
import { changes } from '../schema.js';
import { readServer, type ServerConfig } from './server.js';

const BATCH_SIZE = 200;
const FIRST_RETRY_MS = 1000;
const MAX_RETRY_MS = 300_000;

export interface PusherOptions {
  db: SqliteDb;
  fetch?: typeof fetch;
  now?: () => number;
  /** How the backoff sleeps between retries. */
  wait?: (ms: number) => Promise<void>;
  batchSize?: number;
  log?: (message: string) => void;
}

export interface Pusher {
  status(): SyncStatus;
  /** Wakes the loop; safe to call after every commit. */
  kick(): void;
  /** Clears a halt, which a replaced Token earns, and pushes again. */
  resume(): void;
  subscribe(listener: SyncListener): () => void;
  /** Resolves once the run in flight, if any, has finished. */
  settled(): Promise<void>;
  stop(): void;
}

type Outcome = 'sent' | 'retry' | 'halt';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function reasonOf(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  const stated =
    typeof body === 'object' && body !== null && 'error' in body ? String(body.error) : null;
  return `${response.status} ${stated ?? response.statusText}`.trim();
}

/**
 * Mirrors the local Change log to the Server: unsent Changes in order, in batches, after every
 * commit and on launch. Transport and network errors retry forever; a rejected Token or a batch
 * the Server calls malformed halts the loop and leaves the Changes queued.
 */
export function createPusher(options: PusherOptions): Pusher {
  const { db } = options;
  const send = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const now = options.now ?? Date.now;
  const timestamp = () => new Date(now()).toISOString();
  const wait =
    options.wait ??
    ((ms: number) =>
      new Promise<void>((resolve) => {
        // A backoff in flight must not hold the process open at quit.
        setTimeout(resolve, ms).unref();
      }));
  const batchSize = options.batchSize ?? BATCH_SIZE;
  const log = options.log ?? ((message: string) => console.error(message));
  const listeners = new Set<SyncListener>();

  let halted = false;
  let lastError: SyncError | null = null;
  let running: Promise<void> | null = null;
  let again = false;
  let stopped = false;

  function status(): SyncStatus {
    const { url, token } = readServer(db);
    return {
      configured: url !== null && token !== null,
      pending: db.select({ value: count() }).from(changes).where(isNull(changes.pushedAt)).get()!
        .value,
      lastPushedAt:
        db
          .select({ value: max(changes.pushedAt) })
          .from(changes)
          .get()?.value ?? null,
      lastError,
      halted,
    };
  }

  function emit(): void {
    const current = status();
    for (const listener of listeners) listener(current);
  }

  function nextBatch(): Array<typeof changes.$inferSelect> {
    return (
      db
        .select()
        .from(changes)
        .where(isNull(changes.pushedAt))
        // Insertion order, which two Changes stamped in the same millisecond still separate.
        .orderBy(sql`rowid`)
        .limit(batchSize)
        .all()
    );
  }

  function stampPushed(batch: Array<typeof changes.$inferSelect>, at: string): void {
    const ids = batch.map((change) => change.id);
    db.update(changes).set({ pushedAt: at }).where(inArray(changes.id, ids)).run();
  }

  async function post(config: ServerConfig, batch: Array<typeof changes.$inferSelect>) {
    const body = batch.map(({ pushedAt: _pushedAt, ...change }) => change);
    return send(`${config.url}/changes`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ changes: body }),
    });
  }

  function fail(kind: SyncError['kind'], message: string): void {
    lastError = { kind, message, at: timestamp() };
    halted = kind !== 'network';
  }

  async function attempt(
    config: ServerConfig,
    batch: Array<typeof changes.$inferSelect>,
  ): Promise<Outcome> {
    let response: Response;
    try {
      response = await post(config, batch);
    } catch (error) {
      fail('network', messageOf(error));
      return 'retry';
    }
    if (response.ok) {
      stampPushed(batch, timestamp());
      lastError = null;
      return 'sent';
    }
    const reason = await reasonOf(response);
    if (response.status === 401 || response.status === 403) {
      fail('auth', reason);
      return 'halt';
    }
    if (response.status === 400) {
      // The Server refused the batch itself: a bug here, not a condition that waiting fixes.
      fail('request', reason);
      log(`Push rejected: ${reason}`);
      return 'halt';
    }
    fail('network', reason);
    return 'retry';
  }

  async function drain(): Promise<void> {
    let delay = FIRST_RETRY_MS;
    while (!stopped && !halted) {
      const config = readServer(db);
      if (config.url === null || config.token === null) return;
      const batch = nextBatch();
      if (batch.length === 0) return;
      const outcome = await attempt(config, batch);
      emit();
      if (outcome === 'halt') return;
      if (outcome === 'sent') {
        delay = FIRST_RETRY_MS;
        continue;
      }
      await wait(delay);
      delay = Math.min(delay * 2, MAX_RETRY_MS);
    }
  }

  async function run(): Promise<void> {
    try {
      while (again && !stopped && !halted) {
        again = false;
        await drain();
        emit();
      }
    } catch (error) {
      // A local failure, not a push the Server refused; halting beats a loop nobody can see.
      fail('request', messageOf(error));
      log(`Push failed: ${messageOf(error)}`);
      emit();
    } finally {
      running = null;
    }
  }

  function kick(): void {
    // A halted or stopped pusher still lets the caller see the queue growing.
    if (stopped || halted) return emit();
    again = true;
    if (running) return;
    running = run();
  }

  return {
    status,
    kick,
    resume() {
      halted = false;
      lastError = null;
      kick();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async settled() {
      while (running) await running;
    },
    stop() {
      stopped = true;
    },
  };
}
