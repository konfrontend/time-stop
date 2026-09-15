import { describe, expect, it } from 'vitest';
import { periodBounds } from '@time-stop/domain';
import {
  dashboardSearchSchema,
  filtersToSearch,
  resolveSelection,
  toDashboardInput,
  toExportInput,
} from './dashboardSearch';

const context = { workspaceId: 'w1', projectId: 'p1' };
const today = new Date(2026, 8, 6, 12).toISOString();

describe('resolveSelection', () => {
  it('defaults to the current month in the Context Workspace, every Project, unrounded', () => {
    expect(resolveSelection({}, context, today)).toEqual({
      period: 'month',
      anchor: '2026-09-06',
      ...periodBounds('month', today),
      workspace: 'w1',
      projects: [],
      client: null,
      billable: false,
      rounding: 'none',
    });
  });

  it('takes explicit filters and options over the Context', () => {
    const view = resolveSelection(
      {
        period: 'week',
        anchor: '2026-08-31',
        workspace: 'w2',
        project: 'p2,p3',
        client: 'c1',
        billable: true,
        rounding: '30m',
      },
      context,
      today,
    );
    expect(view).toMatchObject({
      period: 'week',
      ...periodBounds('week', new Date(2026, 7, 31).toISOString()),
      workspace: 'w2',
      projects: ['p2', 'p3'],
      client: 'c1',
      billable: true,
      rounding: '30m',
    });
  });
});

describe('toDashboardInput', () => {
  it('always scopes to the Workspace and drops cleared filters', () => {
    const view = resolveSelection({ workspace: 'w1' }, context, today);
    expect(toDashboardInput(view)).toEqual({ from: view.from, to: view.to, workspaceId: 'w1' });
    expect(
      toDashboardInput({ ...view, projects: ['p1', 'p2'], client: 'c1', billable: true }),
    ).toEqual({
      from: view.from,
      to: view.to,
      workspaceId: 'w1',
      projectIds: ['p1', 'p2'],
      clientId: 'c1',
      billable: true,
    });
  });
});

describe('toExportInput', () => {
  it('carries the Rounding alongside the view', () => {
    const view = resolveSelection({ rounding: '15m' }, context, today);
    expect(toExportInput(view)).toEqual({ ...toDashboardInput(view), rounding: '15m' });
  });
});

describe('dashboardSearchSchema', () => {
  it('rejects a malformed anchor, Period, Rounding or Billable', () => {
    expect(dashboardSearchSchema.safeParse({ anchor: 'yesterday' }).success).toBe(false);
    expect(dashboardSearchSchema.safeParse({ period: 'year' }).success).toBe(false);
    expect(dashboardSearchSchema.safeParse({ rounding: '1h' }).success).toBe(false);
    expect(dashboardSearchSchema.safeParse({ billable: false }).success).toBe(false);
    expect(dashboardSearchSchema.parse({ rounding: '30m' })).toEqual({ rounding: '30m' });
  });
});

describe('filtersToSearch', () => {
  it('joins the Projects and drops the defaults', () => {
    expect(filtersToSearch({ projects: [], client: null, billable: false })).toEqual({
      project: undefined,
      client: undefined,
      billable: undefined,
    });
    expect(filtersToSearch({ projects: ['p1', 'p2'], client: 'c1', billable: true })).toEqual({
      project: 'p1,p2',
      client: 'c1',
      billable: true,
    });
  });
});
