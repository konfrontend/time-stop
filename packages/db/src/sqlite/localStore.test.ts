import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openLocalStore } from './localStore.js';
import { projectInput } from './testApi.js';

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
    expect(first.preferences.windowSize()).toBeNull();
    expect(first.preferences.isRecentRecordsOpen()).toBe(true);

    first.preferences.setAlwaysOnTop(true);
    first.preferences.setWindowSize({ width: 480.4, height: 720 });
    first.preferences.setRecentRecordsOpen(false);
    expect(first.preferences.isAlwaysOnTop()).toBe(true);
    const second = openLocalStore(path);
    expect(second.preferences.isAlwaysOnTop()).toBe(true);
    expect(second.preferences.windowSize()).toEqual({ width: 480, height: 720 });
    expect(second.preferences.isRecentRecordsOpen()).toBe(false);
  });

  it('stops a Timer the previous session left running', async () => {
    const path = freshPath();
    const first = openLocalStore(path);
    const timer = await first.api.record.startTimer();

    const second = openLocalStore(path);
    expect(await second.api.record.getTimer()).toBeNull();
    const [stopped] = await second.api.record.list({
      from: '0000-01-01T00:00:00.000Z',
      to: '9999-12-31T23:59:59.999Z',
    });
    expect(stopped).toMatchObject({ id: timer.id, stop: timer.updatedAt });
  });

  it('seeds an empty Context Project from the latest Record', async () => {
    const path = freshPath();
    const first = openLocalStore(path);
    const { workspaceId } = await first.api.context.get();
    const project = await first.api.project.create({ ...projectInput, workspaceId });
    await first.api.record.create({
      workspaceId,
      projectId: project.id,
      name: '',
      start: '2026-09-15T09:00:00.000Z',
      stop: '2026-09-15T10:00:00.000Z',
    });

    const second = openLocalStore(path);
    expect(await second.api.context.get()).toEqual({ workspaceId, projectId: project.id });
  });
});
