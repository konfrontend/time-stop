import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseTogglCsv } from './togglCsv.js';

const fixture = readFileSync(
  fileURLToPath(new URL('./fixtures/toggl.csv', import.meta.url)),
  'utf8',
);
const zone = 'UTC';

describe('parseTogglCsv', () => {
  it('maps every row, reading times in the given zone', () => {
    const entries = parseTogglCsv(fixture, { zone });

    expect(entries).toHaveLength(5);
    expect(entries[0]).toEqual({
      name: 'Redesign',
      project: 'Acme API',
      client: 'Acme',
      billable: true,
      duration: 2 * 60 * 60 * 1000,
      amount: 220,
      currency: 'USD',
      start: Date.UTC(2026, 8, 7, 12),
      stop: Date.UTC(2026, 8, 7, 14),
    });
  });

  it('reads a zone other than UTC', () => {
    const [first] = parseTogglCsv(fixture, { zone: 'Europe/Berlin' });
    expect(first?.start).toBe(Date.UTC(2026, 8, 7, 10));
  });

  it('turns Toggl’s empty marker into null and keeps commas inside quotes', () => {
    const [, , meditation, reading] = parseTogglCsv(fixture, { zone });

    expect(meditation).toMatchObject({ client: null, amount: null, currency: null });
    expect(reading).toMatchObject({ name: 'Reading, notes', project: null, billable: false });
  });

  it('leaves a running entry without a stop', () => {
    expect(parseTogglCsv(fixture, { zone }).at(-1)).toMatchObject({
      name: 'Running entry',
      stop: null,
    });
  });

  it('works without the optional Client and Amount columns', () => {
    const csv = [
      '"Description","Billable","Project","Start date","Start time","Stop date","Stop time"',
      '"Redesign","Yes","Acme API","2026-09-07","12:00:00","2026-09-07","14:00:00"',
    ].join('\n');
    expect(parseTogglCsv(csv, { zone })[0]).toMatchObject({
      client: null,
      amount: null,
      currency: null,
      project: 'Acme API',
    });
  });

  it('refuses a file without the columns it needs', () => {
    expect(() => parseTogglCsv('"Description","Billable"\n"x","Yes"', { zone })).toThrow(
      'Start date',
    );
  });
});

describe('parseTogglCsv, on the file Toggl actually writes', () => {
  it('ignores the byte order mark in front of the first column', () => {
    expect(parseTogglCsv(`\uFEFF${fixture}`, { zone })[0]).toMatchObject({ name: 'Redesign' });
  });
});
