import { describe, expect, it } from 'vitest';
import { v7 as uuid } from 'uuid';
import { buildReport } from './rules.js';
import type { ReportRow } from './Report.js';
import type { Client } from '../client/Client.js';
import type { Project } from '../project/Project.js';
import type { Record } from '../record/Record.js';

const zone = 'utc';
const from = '2026-07-01T00:00:00.000Z';
const to = '2026-08-01T00:00:00.000Z';
const at = (day: number, hour: number, minute = 0) =>
  new Date(Date.UTC(2026, 6, day, hour, minute)).toISOString();

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: uuid(),
    workspaceId: uuid(),
    clientId: null,
    name: 'Acme site',
    rate: 100,
    limitMin: null,
    limitMax: null,
    limitPeriod: null,
    startDate: null,
    endDate: null,
    color: '#4f6bd9',
    archived: false,
    updatedAt: from,
    ...overrides,
  };
}

const client = (name: string): Client => ({
  id: uuid(),
  workspaceId: uuid(),
  name,
  updatedAt: from,
});

function row(overrides: Partial<Record> & Partial<ReportRow> = {}): ReportRow {
  const {
    project: rowProject = project(),
    client: rowClient = client('Acme'),
    currency = 'EUR',
    ...record
  } = overrides;
  return {
    record: {
      id: uuid(),
      workspaceId: uuid(),
      projectId: rowProject?.id ?? null,
      actorId: uuid(),
      name: 'Redesign',
      start: at(1, 9),
      stop: at(1, 10),
      updatedAt: from,
      ...record,
    },
    project: rowProject,
    client: rowClient,
    currency,
  };
}

const report = (rows: ReportRow[], rounding: 'none' | '15m' = 'none') =>
  buildReport({ rows, from, to, rounding, zone });
const lines = (rows: ReportRow[], rounding: 'none' | '15m' = 'none') =>
  report(rows, rounding)
    .csv.replace(/^\ufeff/, '')
    .trimEnd()
    .split('\r\n');

describe('buildReport', () => {
  it('produces the reference shape for a single-Project view', () => {
    expect(
      lines([
        row({ start: at(1, 9), stop: at(1, 11), name: 'Redesign' }),
        row({ start: at(2, 13), stop: at(2, 14, 15), name: 'Review' }),
      ]),
    ).toEqual([
      'Project,Acme site',
      'Client,Acme',
      'Currency,EUR',
      'Rate,100',
      'Limits,',
      'Range,2026-07-01,2026-07-31',
      'Rounding,none',
      '',
      'Date,Start,Stop,Name,Billable,Hours,Rate,Amount',
      '2026-07-01,09:00,11:00,Redesign,yes,2.00,100,200.00',
      '2026-07-02,13:00,14:15,Review,yes,1.25,100,125.00',
      'Total,,,,,3.25,,325.00',
      'Billable,,,,,3.25,,325.00',
    ]);
  });

  it('leaves out the running Timer and blanks the Amount of a non-Billable Record', () => {
    expect(
      lines([
        row({ start: at(1, 9), stop: at(1, 10) }),
        row({ project: project({ rate: null }), start: at(1, 11), stop: at(1, 12), name: 'Admin' }),
        row({ start: at(1, 15), stop: null, name: 'Running' }),
      ]).slice(8),
    ).toEqual([
      'Date,Start,Stop,Name,Billable,Hours,Rate,Amount',
      '2026-07-01,09:00,10:00,Redesign,yes,1.00,100,100.00',
      '2026-07-01,11:00,12:00,Admin,no,1.00,,',
      'Total,,,,,2.00,,100.00',
      'Billable,,,,,1.00,,100.00',
    ]);
  });

  it('adds a Project column and lists the Projects when the view holds several', () => {
    const other = project({
      name: 'Beta app',
      rate: 50,
      limitMin: 2,
      limitMax: 4,
      limitPeriod: 'month',
    });
    expect(
      lines([
        row({
          project: project({ limitMin: 2, limitPeriod: 'week' }),
          start: at(3, 9),
          stop: at(3, 10),
        }),
        row({ project: other, client: client('Beta'), start: at(2, 9), stop: at(2, 10) }),
        row({ project: null, client: null, start: at(1, 9), stop: at(1, 10) }),
      ]),
    ).toEqual([
      'Project,Acme site,Beta app,No Project',
      'Client,Acme,Beta,No Client',
      'Currency,EUR',
      'Rate,100,50,',
      'Limits,≥ 2 h / week,2–4 h / month,',
      'Range,2026-07-01,2026-07-31',
      'Rounding,none',
      '',
      'Project,Date,Start,Stop,Name,Billable,Hours,Rate,Amount',
      'Acme site,2026-07-03,09:00,10:00,Redesign,yes,1.00,100,100.00',
      'Beta app,2026-07-02,09:00,10:00,Redesign,yes,1.00,50,50.00',
      'No Project,2026-07-01,09:00,10:00,Redesign,no,1.00,,',
      'Total,,,,,,3.00,,150.00',
      'Billable,,,,,,2.00,,150.00',
    ]);
  });

  it('gives each Currency its own Total and Billable pair', () => {
    const other = project({ name: 'Beta app', rate: null });
    const rows = [
      row({ start: at(1, 9), stop: at(1, 11) }),
      row({
        project: other,
        client: client('Beta'),
        currency: 'USD',
        start: at(1, 12),
        stop: at(1, 13),
      }),
    ];
    expect(lines(rows)[2]).toBe('Currency,EUR,USD');
    expect(lines(rows).slice(-4)).toEqual([
      'Total (EUR),,,,,,2.00,,200.00',
      'Billable (EUR),,,,,,2.00,,200.00',
      'Total (USD),,,,,,1.00,,',
      'Billable (USD),,,,,,0.00,,',
    ]);
  });

  it('rounds Hours and Amount per Record before the totals', () => {
    expect(
      lines(
        [
          row({ start: at(1, 9), stop: at(1, 9, 7) }),
          row({ start: at(1, 10), stop: at(1, 10, 50), name: 'Review' }),
        ],
        '15m',
      ).slice(5),
    ).toEqual([
      'Range,2026-07-01,2026-07-31',
      'Rounding,15m',
      '',
      'Date,Start,Stop,Name,Billable,Hours,Rate,Amount',
      '2026-07-01,09:00,09:07,Redesign,yes,0.00,100,0.00',
      '2026-07-01,10:00,10:50,Review,yes,0.75,100,75.00',
      'Total,,,,,0.75,,75.00',
      'Billable,,,,,0.75,,75.00',
    ]);
  });

  it('adds the shown Hours up, so the column sums on screen', () => {
    const third = { start: at(1, 9), stop: at(1, 9, 20) };
    expect(
      lines([
        row(third),
        row({ ...third, start: at(1, 10), stop: at(1, 10, 20) }),
        row({ ...third, start: at(1, 11), stop: at(1, 11, 20) }),
      ]).slice(-3),
    ).toEqual([
      '2026-07-01,11:00,11:20,Redesign,yes,0.33,100,33.33',
      'Total,,,,,0.99,,99.99',
      'Billable,,,,,0.99,,99.99',
    ]);
  });

  it('names the file after the one Project or Client of the view, else all', () => {
    const beta = project({ name: 'Beta app' });
    const single = row({ start: at(1, 9), stop: at(1, 10) });
    expect(report([single]).filename).toBe('acme-site_2026-07-01_2026-07-31.csv');
    expect(
      report([single, row({ project: beta, start: at(2, 9), stop: at(2, 10) })]).filename,
    ).toBe('acme_2026-07-01_2026-07-31.csv');
    expect(
      report([
        single,
        row({ project: beta, client: client('Beta'), start: at(2, 9), stop: at(2, 10) }),
      ]).filename,
    ).toBe('all_2026-07-01_2026-07-31.csv');
    expect(report([]).filename).toBe('all_2026-07-01_2026-07-31.csv');
  });

  it('starts with a BOM and separates lines with CRLF, so Excel reads non-ASCII Names', () => {
    const { csv } = report([row({ project: project({ name: 'Säule' }), name: 'Rédesign — v2' })]);
    const bytes = Buffer.from(csv, 'utf8');

    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv).not.toMatch(/(?<!\r)\n/);
    const read = bytes
      .toString('utf8')
      .replace(/^\ufeff/, '')
      .split('\r\n');
    expect(read[0]).toBe('Project,Säule');
    expect(read[9]).toContain('Rédesign — v2');
  });

  it('quotes a cell holding a comma or a quote', () => {
    expect(lines([row({ name: 'Redesign, "v2"' })])[9]).toBe(
      '2026-07-01,09:00,10:00,"Redesign, ""v2""",yes,1.00,100,100.00',
    );
  });
});
