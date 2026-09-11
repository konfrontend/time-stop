import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openLocalStore } from './localStore.js';

const freshPath = () =>
  join(mkdtempSync(join(tmpdir(), 'time-stop-store-')), 'nested', 'timestop.sqlite3');

describe('openLocalStore', () => {
  it('opens a bootstrapped in-memory store with the default Workspace', async () => {
    const store = openLocalStore(':memory:');

    expect(store.path).toBe(':memory:');
    expect(await store.api.workspace.list()).toEqual([
      expect.objectContaining({ name: 'Default' }),
    ]);
    expect(store.pusher.status()).toMatchObject({ configured: false, pending: 1 });
  });

  it('creates the folder of the file and keeps preferences across reopening', () => {
    const path = freshPath();
    const first = openLocalStore(path);
    expect(existsSync(path)).toBe(true);
    expect(first.preferences.isAlwaysOnTop()).toBe(false);

    first.preferences.setAlwaysOnTop(true);
    expect(first.preferences.isAlwaysOnTop()).toBe(true);
    expect(openLocalStore(path).preferences.isAlwaysOnTop()).toBe(true);
  });

  it('stops a Timer the previous session left running', async () => {
    const path = freshPath();
    const first = openLocalStore(path);
    const timer = await first.api.record.startTimer();

    const second = openLocalStore(path);
    expect(await second.api.record.getTimer()).toBeNull();
    const [stopped] = await second.api.record.list({ from: 0, to: Number.MAX_SAFE_INTEGER });
    expect(stopped).toMatchObject({ id: timer.id, stop: timer.updatedAt });
  });
});
