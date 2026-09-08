import { describe, expect, it } from 'vitest';
import { v7 as uuid } from 'uuid';
import { buildReport, roundDurationMs } from './report.js';
import type { ReportRow } from './report.js';
import type { Client, Project, Record } from './entities.js';

const zone = 'utc';
const MINUTE = 60_000;
const from = Date.UTC(2026, 6, 1);
const to = Date.UTC(2026, 7, 1);
const at = (day: number, hour: number, minute = 0) => Date.UTC(2026, 6, day, hour, minute);

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
    updatedAt: 0,
    ...overrides,
  };
}

const client = (name: string): Client => ({
  id: uuid(),
  workspaceId: uuid(),
  name,
  updatedAt: 0,
});

function row(overrides: Partial<Record> & Partial<ReportRow> = {}): ReportRow {
  const {
    project: rowProject = project(),
    client: rowClient = client('Acme'),
    currency = 'EUR',
    workspace = 'Work',
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
      rate: rowProject?.rate ?? null,
      billable: true,
      updatedAt: 0,
      ...record,
    },
    project: rowProject,
    client: rowClient,
    currency,
    workspace,
  };
}

const report = (rows: ReportRow[], rounding: 'none' | '15m' = 'none') =>
  buildReport({ rows, from, to, rounding, zone });
const lines = (rows: ReportRow[], rounding: 'none' | '15m' = 'none') =>
  report(rows, rounding).csv.trimEnd().split('\n');

describe('roundDurationMs', () => {
  it('leaves the Duration alone without Rounding', () => {
    expect(roundDurationMs(7 * MINUTE, 'none')).toBe(7 * MINUTE);
  });

  it('rounds to the nearest 15 minutes, keeping 7 minutes and 0 at 0', () => {
    expect(roundDurationMs(7 * MINUTE, '15m')).toBe(0);
    expect(roundDurationMs(0, '15m')).toBe(0);
    expect(roundDurationMs(8 * MINUTE, '15m')).toBe(15 * MINUTE);
    expect(roundDurationMs(70 * MINUTE, '15m')).toBe(75 * MINUTE);
  });
});

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
      'Range,2026-07-01,2026-07-31',
      'Rounding,none',
      'Currency,EUR',
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
        row({ start: at(1, 11), stop: at(1, 12), billable: false, name: 'Admin' }),
        row({ start: at(1, 15), stop: null, name: 'Running' }),
      ]).slice(6),
    ).toEqual([
      'Date,Start,Stop,Name,Billable,Hours,Rate,Amount',
      '2026-07-01,09:00,10:00,Redesign,yes,1.00,100,100.00',
      '2026-07-01,11:00,12:00,Admin,no,1.00,100,',
      'Total,,,,,2.00,,100.00',
      'Billable,,,,,1.00,,100.00',
    ]);
  });

  it('adds a Project column and lists the Projects when the view holds several', () => {
    const other = project({ name: 'Beta app', rate: 50 });
    expect(
      lines([
        row({ start: at(3, 9), stop: at(3, 10) }),
        row({ project: other, client: client('Beta'), start: at(2, 9), stop: at(2, 10), rate: 50 }),
        row({ project: null, client: null, start: at(1, 9), stop: at(1, 10), rate: null }),
      ]),
    ).toEqual([
      'Project,Acme site,Beta app,No Project',
      'Client,Acme,Beta,No Client',
      'Range,2026-07-01,2026-07-31',
      'Rounding,none',
      'Currency,EUR',
      '',
      'Project,Date,Start,Stop,Name,Billable,Hours,Rate,Amount',
      'Acme site,2026-07-03,09:00,10:00,Redesign,yes,1.00,100,100.00',
      'Beta app,2026-07-02,09:00,10:00,Redesign,yes,1.00,50,50.00',
      'No Project,2026-07-01,09:00,10:00,Redesign,yes,1.00,,',
      'Total,,,,,,3.00,,150.00',
      'Billable,,,,,,3.00,,150.00',
    ]);
  });

  it('gives each Currency its own Total and Billable pair', () => {
    const other = project({ name: 'Beta app', rate: 50 });
    const rows = [
      row({ start: at(1, 9), stop: at(1, 11) }),
      row({
        project: other,
        client: client('Beta'),
        currency: 'USD',
        start: at(1, 12),
        stop: at(1, 13),
        rate: 50,
        billable: false,
      }),
    ];
    expect(lines(rows)[4]).toBe('Currency,EUR,USD');
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
      ).slice(3),
    ).toEqual([
      'Rounding,15m',
      'Currency,EUR',
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

  it('names the file after the one Project, Client or Workspace of the view, else all', () => {
    const beta = project({ name: 'Beta app' });
    const single = row({ start: at(1, 9), stop: at(1, 10) });
    expect(report([single]).filename).toBe('acme-site_2026-07-01_2026-07-31.csv');
    expect(
      report([single, row({ project: beta, start: at(2, 9), stop: at(2, 10) })]).filename,
    ).toBe('acme_2026-07-01_2026-07-31.csv');
    expect(
      report([single, row({ project: beta, client: client('Beta'), start: at(2, 9) })]).filename,
    ).toBe('work_2026-07-01_2026-07-31.csv');
    expect(
      report([single, row({ project: beta, client: client('Beta'), workspace: 'Side' })]).filename,
    ).toBe('all_2026-07-01_2026-07-31.csv');
    expect(report([]).filename).toBe('all_2026-07-01_2026-07-31.csv');
  });

  it('quotes a cell holding a comma or a quote', () => {
    expect(lines([row({ name: 'Redesign, "v2"' })])[7]).toBe(
      '2026-07-01,09:00,10:00,"Redesign, ""v2""",yes,1.00,100,100.00',
    );
  });
});
