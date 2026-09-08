import { describe, expect, it } from 'vitest';
import type { Record } from '@time-stop/domain';
import { trayLabel, trayLine, windowTitle } from './shellText';

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

const names = { recordName: 'Invoice run', projectName: 'Acme API', workspaceName: 'Gembag' };

describe('trayLabel', () => {
  it('names the Record first', () => {
    expect(trayLabel(names)).toBe('Invoice run');
  });

  it('falls back to the Project, then the Workspace', () => {
    expect(trayLabel({ ...names, recordName: '' })).toBe('Acme API');
    expect(trayLabel({ ...names, recordName: '  ', projectName: null })).toBe('Gembag');
  });
});

describe('trayLine', () => {
  it('names the Context with no Timer', () => {
    expect(trayLine({ timer: null, ...names, now })).toBe('Acme API');
  });

  it('shows the elapsed Timer beside the name', () => {
    expect(trayLine({ timer: { ...running, name: 'Invoice run' }, ...names, now })).toBe(
      '01:01:01 Invoice run',
    );
  });

  it('falls back to the Project name while a Timer without a Name runs', () => {
    expect(trayLine({ timer: running, ...names, recordName: '', now })).toBe('01:01:01 Acme API');
  });

  it('truncates a name that would outgrow the menu bar', () => {
    const projectName = 'Migration of the legacy billing platform';
    expect(trayLine({ timer: running, ...names, recordName: '', projectName, now })).toBe(
      '01:01:01 Migration of t…',
    );
    expect(trayLine({ timer: null, ...names, recordName: '', projectName, now })).toBe(
      'Migration of the legacy…',
    );
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
