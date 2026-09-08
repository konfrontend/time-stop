import { describe, expect, it } from 'vitest';
import type { Record } from '@time-stop/domain';
import { trayLine, windowTitle } from './shellText.js';

const start = Date.UTC(2026, 0, 1, 9, 0, 0);
const now = start + 3_661_000;

const running: Record = {
  id: 'r1',
  workspaceId: 'w1',
  projectId: 'p1',
  actorId: 'a1',
  name: '',
  start,
  stop: null,
  rate: null,
  billable: false,
  updatedAt: start,
};

describe('trayLine', () => {
  it('shows standby with no Timer', () => {
    expect(trayLine({ timer: null, projectName: 'Acme API', now })).toBe('○ Standby');
  });

  it('shows the elapsed Timer and the Project name', () => {
    expect(trayLine({ timer: running, projectName: 'Acme API', now })).toBe('● 01:01:01 Acme API');
  });

  it('shows the Timer alone without a Project', () => {
    expect(trayLine({ timer: running, projectName: null, now })).toBe('● 01:01:01');
  });

  it('drops a Project name that does not fit', () => {
    const projectName = 'Migration of the legacy billing platform';
    expect(trayLine({ timer: running, projectName, now })).toBe('● 01:01:01');
  });
});

describe('windowTitle', () => {
  it('carries the elapsed time while a Timer runs', () => {
    expect(windowTitle(running, now)).toBe('Time Stop — 01:01:01');
  });

  it('is the app name on standby', () => {
    expect(windowTitle(null, now)).toBe('Time Stop');
  });
});
