import { beforeEach, describe, expect, it } from 'vitest';
import { periodBounds } from '@time-stop/domain';
import type { Project, Record, Workspace } from '@time-stop/domain';
import { projectInput, testApi, type TestApi } from '../testApi.js';
import { records } from '../schema.js';

const HOUR = 3_600_000;
const base = new Date(2026, 6, 15, 12).toISOString();
const month = periodBounds('month', base);

let t: TestApi;
let work: Workspace;
let acme: Project;

function insert(start: string, overrides: Partial<Record> = {}): Record {
  const record: Record = {
    id: crypto.randomUUID(),
    workspaceId: acme.workspaceId,
    projectId: acme.id,
    actorId: t.identity.actorId,
    name: 'Redesign',
    start,
    stop: new Date(Date.parse(start) + HOUR).toISOString(),
    updatedAt: start,
    ...overrides,
  };
  t.db.insert(records).values(record).run();
  return record;
}

const day = (n: number, hour: number, minute = 0) =>
  new Date(2026, 6, n, hour, minute).toISOString();

beforeEach(async () => {
  t = testApi();
  t.clock.now = Date.parse(base);
  [work] = (await t.api.workspace.list()) as [Workspace];
  work = await t.api.workspace.update({ id: work.id, name: 'Work', currency: 'EUR' });
  const client = await t.api.client.create({ workspaceId: work.id, name: 'Acme' });
  acme = await t.api.project.create({
    ...projectInput,
    workspaceId: work.id,
    clientId: client.id,
    name: 'Acme site',
    rate: 100,
    limitMin: 2,
    limitPeriod: 'week',
  });
});

describe('report.export', () => {
  it('reports the filtered view, leaving the running Timer out', async () => {
    insert(day(1, 9));
    insert(day(2, 13), { stop: day(2, 14, 15), name: 'Review' });
    insert(day(3, 9), { stop: null, name: 'Running' });

    const report = await t.api.report.export({
      from: month.from,
      to: month.to,
      workspaceId: work.id,
      rounding: 'none',
    });

    expect(report.filename).toBe('acme-site_2026-07-01_2026-07-31.csv');
    expect(report.csv).toBe(
      '\ufeff' +
        [
          'Project,Acme site',
          'Client,Acme',
          'Currency,EUR',
          'Rate,100',
          'Limits,≥ 2 h / week',
          'Range,2026-07-01,2026-07-31',
          'Rounding,none',
          '',
          'Date,Start,Stop,Name,Billable,Hours,Rate,Amount',
          '2026-07-01,09:00,10:00,Redesign,yes,1.00,100,100.00',
          '2026-07-02,13:00,14:15,Review,yes,1.25,100,125.00',
          'Total,,,,,2.25,,225.00',
          'Billable,,,,,2.25,,225.00',
          '',
        ].join('\r\n'),
    );
  });

  it('rounds each Record to the nearest 15 minutes', async () => {
    insert(day(1, 9), { stop: day(1, 9, 7) });

    const report = await t.api.report.export({
      from: month.from,
      to: month.to,
      rounding: '15m',
    });

    expect(report.csv).toContain('2026-07-01,09:00,09:07,Redesign,yes,0.00,100,0.00');
    expect(report.csv).toContain('Total,,,,,0.00,,0.00');
  });
});
