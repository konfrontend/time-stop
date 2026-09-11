import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseTogglCsv } from './togglCsv';

/** Rows lifted verbatim from a Toggl export, byte order mark and all. */
const fixture = readFileSync(
  fileURLToPath(new URL('./fixtures/toggl.csv', import.meta.url)),
  'utf8',
);
const zone = 'UTC';

describe('parseTogglCsv', () => {
  it('maps every row, reading times in the given zone', () => {
    const entries = parseTogglCsv(fixture, { zone });

    expect(entries).toHaveLength(6);
    expect(entries[0]).toEqual({
      name: 'v1',
      project: 'Time Tracker App',
      client: null,
      duration: 90 * 60 * 1000,
      amount: null,
      currency: null,
      start: '2026-09-08T14:51:41.000Z',
      stop: '2026-09-08T16:26:15.000Z',
    });
  });

  it('reads the first column past the byte order mark Toggl writes', () => {
    expect(fixture.startsWith('\uFEFF')).toBe(true);
    expect(parseTogglCsv(fixture, { zone })[0]?.name).toBe('v1');
  });

  it('reads a zone other than UTC', () => {
    const [first] = parseTogglCsv(fixture, { zone: 'Europe/Berlin' });
    expect(first?.start).toBe('2026-09-08T12:51:41.000Z');
  });

  it('takes Amount, Currency and a duration the span disagrees with', () => {
    const billed = parseTogglCsv(fixture, { zone })[1]!;

    expect(billed).toMatchObject({ amount: 182, currency: 'USD' });
    expect(billed.duration).toBe(3.5 * 60 * 60 * 1000);
    expect(Date.parse(billed.stop!) - Date.parse(billed.start)).toBeGreaterThan(billed.duration!);
  });

  it('turns Toggl’s empty marker into null', () => {
    expect(parseTogglCsv(fixture, { zone })[3]).toMatchObject({
      duration: null,
      amount: null,
      currency: null,
    });
  });

  it('reads the Client column when the export carries one', () => {
    const csv = [
      '"Description","Billable","Project","Client","Start date","Start time","Stop date","Stop time"',
      '"Redesign","Yes","Acme API","Acme","2026-09-07","12:00:00","2026-09-07","14:00:00"',
    ].join('\n');
    expect(parseTogglCsv(csv, { zone })[0]).toMatchObject({ client: 'Acme', project: 'Acme API' });
  });

  it('keeps a comma inside quotes and leaves a running entry without a stop', () => {
    const csv = [
      '"Description","Billable","Project","Start date","Start time","Stop date","Stop time"',
      '"Reading, notes","No","-","2026-09-08","09:00:00","",""',
    ].join('\n');
    expect(parseTogglCsv(csv, { zone })[0]).toMatchObject({
      name: 'Reading, notes',
      project: null,
      stop: null,
    });
  });

  it('refuses a file without the columns it needs', () => {
    expect(() => parseTogglCsv('"Description","Billable"\n"x","Yes"', { zone })).toThrow(
      'Start date',
    );
  });
});
