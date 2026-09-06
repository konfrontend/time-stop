import { describe, expect, it } from 'vitest';
import { periodBounds } from '@time-stop/domain';
import {
  dashboardSearchSchema,
  filtersToSearch,
  resolveSelection,
  toDashboardInput,
} from './dashboardSearch';

const context = { workspaceId: 'w1', projectId: 'p1' };
const today = new Date(2026, 8, 6, 12).getTime();

describe('resolveSelection', () => {
  it('defaults to the current month, pre-filtered to the Context', () => {
    expect(resolveSelection({}, context, today)).toEqual({
      period: 'month',
      anchor: '2026-09-06',
      ...periodBounds('month', today),
      workspace: 'w1',
      project: 'p1',
      client: null,
      billable: 'all',
    });
  });

  it('keeps a cleared Workspace filter cross-Workspace', () => {
    const view = resolveSelection(
      { period: 'week', anchor: '2026-08-31', workspace: null, billable: 'yes' },
      context,
      today,
    );
    expect(view).toMatchObject({
      period: 'week',
      anchor: '2026-08-31',
      ...periodBounds('week', new Date(2026, 7, 31).getTime()),
      workspace: null,
      project: null,
      billable: 'yes',
    });
  });

  it('takes explicit filters over the Context', () => {
    expect(
      resolveSelection({ workspace: 'w2', project: 'p2', client: 'c1' }, context, today),
    ).toMatchObject({ workspace: 'w2', project: 'p2', client: 'c1' });
  });
});

describe('toDashboardInput', () => {
  it('drops cleared filters and maps Billable to a boolean', () => {
    const view = resolveSelection({ workspace: null, billable: 'no' }, context, today);
    expect(toDashboardInput(view)).toEqual({ from: view.from, to: view.to, billable: false });
    expect(toDashboardInput({ ...view, project: 'p1', billable: 'yes' })).toEqual({
      from: view.from,
      to: view.to,
      projectId: 'p1',
      billable: true,
    });
  });
});

describe('dashboardSearchSchema', () => {
  it('rejects a malformed anchor or range', () => {
    expect(dashboardSearchSchema.safeParse({ anchor: 'yesterday' }).success).toBe(false);
    expect(dashboardSearchSchema.safeParse({ period: 'year' }).success).toBe(false);
    expect(dashboardSearchSchema.parse({ workspace: null })).toEqual({ workspace: null });
  });
});

describe('filtersToSearch', () => {
  it('keeps a cleared Workspace explicit and drops the other defaults', () => {
    expect(
      filtersToSearch({ workspace: null, project: null, client: null, billable: 'all' }),
    ).toEqual({ workspace: null, project: undefined, client: undefined, billable: undefined });
    expect(
      filtersToSearch({ workspace: 'w1', project: 'p1', client: 'c1', billable: 'no' }),
    ).toEqual({ workspace: 'w1', project: 'p1', client: 'c1', billable: 'no' });
  });
});
