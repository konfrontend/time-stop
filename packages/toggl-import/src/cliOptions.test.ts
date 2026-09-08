import { describe, expect, it } from 'vitest';
import { parseCliArgs } from './cliOptions.js';

describe('parseCliArgs', () => {
  it('reads the paths and the optional Workspace and zone', () => {
    expect(
      parseCliArgs([
        '--csv',
        'toggl.csv',
        '--db',
        'time-stop.db',
        '--workspace',
        'Toggl',
        '--zone',
        'UTC',
      ]),
    ).toEqual({ csv: 'toggl.csv', db: 'time-stop.db', workspaceName: 'Toggl', zone: 'UTC' });
  });

  it('falls back to the zone of this machine and no Workspace', () => {
    const options = parseCliArgs(['--csv', 'toggl.csv', '--db', 'time-stop.db']);
    expect(options.workspaceName).toBeUndefined();
    expect(options.zone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('refuses a call without both paths', () => {
    expect(() => parseCliArgs(['--csv', 'toggl.csv'])).toThrow('Usage');
  });
});
