import { beforeEach, describe, expect, it } from 'vitest';
import { periodBounds } from '@time-stop/domain';
import type { Project, Record, Workspace } from '@time-stop/domain';
import { projectInput, testApi, type TestApi } from '../testApi.js';
import { records } from '../schema.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// A month wide enough that a week around `base` never crosses its edge.
const base = '2026-09-15T12:00:00.000Z';
const month = periodBounds('month', base);
const week = periodBounds('week', base);

const plus = (timestamp: string, ms: number) => new Date(Date.parse(timestamp) + ms).toISOString();

let t: TestApi;
let work: Workspace;
let personal: Workspace;
let acme: Project;
let unpaid: Project;

/** Inserts a stopped Record directly, skipping the Timer, so spans can be placed freely. */
function insert(overrides: Partial<Record> & { start: string }): Record {
  const project = overrides.projectId
    ? [acme, unpaid].find((p) => p.id === overrides.projectId)
    : null;
  const record: Record = {
    id: crypto.randomUUID(),
    workspaceId: project?.workspaceId ?? work.id,
    projectId: null,
    actorId: t.identity.actorId,
    name: '',
    stop: plus(overrides.start, HOUR),
    updatedAt: overrides.start,
    ...overrides,
  };
  t.db.insert(records).values(record).run();
  return record;
}

const view = (input: Partial<Parameters<TestApi['api']['dashboard']['get']>[0]> = {}) =>
  t.api.dashboard.get({ from: month.from, to: month.to, ...input });
const ids = async (input?: Parameters<typeof view>[0]) =>
  (await view(input)).rows.map((r) => r.record.id);

beforeEach(async () => {
  t = testApi();
  t.clock.now = Date.parse(base);
  [work] = (await t.api.workspace.list()) as [Workspace];
  work = await t.api.workspace.update({ id: work.id, name: 'Work', currency: 'USD' });
  personal = await t.api.workspace.create({ name: 'Personal', currency: 'EUR' });
  const client = await t.api.client.create({ workspaceId: work.id, name: 'Acme' });
  acme = await t.api.project.create({ ...projectInput, workspaceId: work.id, clientId: client.id });
  unpaid = await t.api.project.create({
    ...projectInput,
    workspaceId: personal.id,
    name: 'Meditation',
    rate: null,
  });
});

describe('dashboard.get', () => {
  it('lists Records started in the Range, newest first, with Project, Client and Currency', async () => {
    const before = insert({ start: plus(month.from, -HOUR), stop: plus(month.from, HOUR) });
    const first = insert({ start: month.from, projectId: acme.id });
    const last = insert({ start: plus(month.to, -HOUR), projectId: unpaid.id });
    insert({ start: month.to });

    const { rows } = await view();
    expect(rows.map((r) => r.record.id)).toEqual([last.id, first.id]);
    expect(rows.map((r) => r.record.id)).not.toContain(before.id);
    expect(rows[1]).toMatchObject({
      project: acme,
      client: { name: 'Acme' },
      currency: 'USD',
      limits: null,
    });
    expect(rows[0]).toMatchObject({ project: unpaid, client: null, currency: 'EUR' });
  });

  it('filters by Workspace, Project, Client and Billable', async () => {
    const paid = insert({ start: base, projectId: acme.id });
    const free = insert({ start: plus(base, 2 * HOUR), projectId: unpaid.id });
    const bare = insert({ start: plus(base, 4 * HOUR) });

    expect(await ids({ workspaceId: work.id })).toEqual([bare.id, paid.id]);
    expect(await ids({ workspaceId: personal.id })).toEqual([free.id]);
    expect(await ids({ projectIds: [acme.id] })).toEqual([paid.id]);
    expect(await ids({ projectIds: [acme.id, unpaid.id] })).toEqual([free.id, paid.id]);
    expect(await ids({ projectIds: [] })).toEqual([bare.id, free.id, paid.id]);
    expect(await ids({ clientId: acme.clientId! })).toEqual([paid.id]);
    expect(await ids({ billable: true })).toEqual([paid.id]);
    expect(await ids({ billable: false })).toEqual([bare.id, free.id]);
    expect(await ids()).toEqual([bare.id, free.id, paid.id]);
  });

  it('narrows to a week', async () => {
    const inside = insert({ start: week.from });
    insert({ start: week.to });
    insert({ start: plus(week.from, -HOUR) });
    expect(await ids({ from: week.from, to: week.to })).toEqual([inside.id]);
  });

  it('totals hours, Billable hours and Amount per Currency, counting the Timer', async () => {
    insert({ start: base, stop: plus(base, 2 * HOUR), projectId: acme.id });
    insert({ start: plus(base, 2 * HOUR), stop: plus(base, 3 * HOUR), projectId: unpaid.id });
    insert({ start: plus(base, 3 * HOUR) });
    await t.api.context.set({ workspaceId: personal.id, projectId: null });
    t.clock.now = Date.parse(base) + 5 * HOUR;
    await t.api.record.startTimer();
    t.clock.now = Date.parse(base) + 5.5 * HOUR;

    const { totals } = await view();
    expect(totals).toEqual({
      hours: 4.5,
      billableHours: 2,
      amounts: [{ currency: 'USD', amount: 220 }],
    });
  });

  it('totals only the filtered view', async () => {
    insert({ start: base, projectId: acme.id });
    insert({ start: plus(base, 2 * HOUR), projectId: unpaid.id });
    expect((await view({ workspaceId: personal.id })).totals).toEqual({
      hours: 1,
      billableHours: 0,
      amounts: [],
    });
  });

  it('is neither Billable nor priced in a Workspace without a Currency', async () => {
    await t.api.workspace.update({ id: work.id, name: 'Work', currency: null });
    const record = insert({ start: base, projectId: acme.id });
    const { rows, totals } = await view();
    expect(rows[0]?.currency).toBeNull();
    expect(totals).toEqual({ hours: 1, billableHours: 0, amounts: [] });
    expect(await ids({ billable: true })).toEqual([]);
    expect(await ids({ billable: false })).toEqual([record.id]);
  });

  it('prices every Record of a Project by its current Rate, past ones included', async () => {
    insert({ start: base, stop: plus(base, 2 * HOUR), projectId: acme.id });
    await t.api.project.update({ ...projectInput, id: acme.id, rate: 150 });
    expect((await view()).totals.amounts).toEqual([{ currency: 'USD', amount: 300 }]);

    await t.api.project.update({ ...projectInput, id: acme.id, rate: null });
    expect((await view()).totals).toEqual({ hours: 2, billableHours: 0, amounts: [] });
  });

  it('sums a Project’s Durations over the calendar week holding each row', async () => {
    const limited = await t.api.project.update({
      ...projectInput,
      id: acme.id,
      limitMin: 2,
      limitMax: 4,
      limitPeriod: 'week',
    });
    const inWeek = insert({
      start: week.from,
      stop: plus(week.from, 3 * HOUR),
      projectId: limited.id,
    });
    insert({
      start: plus(week.from, DAY),
      stop: plus(week.from, DAY + 2 * HOUR),
      projectId: limited.id,
    });
    const nextWeek = insert({ start: week.to, projectId: limited.id });
    insert({ start: plus(week.from, 2 * DAY), projectId: unpaid.id });

    const { rows } = await view();
    expect(rows.find((r) => r.record.id === inWeek.id)?.limits).toEqual({
      period: 'week',
      usedMs: 5 * HOUR,
      min: 2,
      max: 4,
    });
    expect(rows.find((r) => r.record.id === nextWeek.id)?.limits).toEqual({
      period: 'week',
      usedMs: HOUR,
      min: 2,
      max: 4,
    });
    expect(rows.find((r) => r.record.projectId === unpaid.id)?.limits).toBeNull();
  });

  it('sums over the calendar month, counting the running Timer up to now', async () => {
    const limited = await t.api.project.update({
      ...projectInput,
      id: acme.id,
      limitMax: 40,
      limitPeriod: 'month',
    });
    insert({ start: plus(month.from, -HOUR), projectId: limited.id });
    const row = insert({
      start: month.from,
      stop: plus(month.from, 2 * HOUR),
      projectId: limited.id,
    });
    await t.api.context.set({ workspaceId: work.id, projectId: limited.id });
    t.clock.now = Date.parse(base);
    await t.api.record.startTimer();
    t.clock.now = Date.parse(base) + HOUR;

    const { rows } = await view();
    expect(rows.find((r) => r.record.id === row.id)?.limits).toEqual({
      period: 'month',
      usedMs: 3 * HOUR,
      min: null,
      max: 40,
    });
  });
});
