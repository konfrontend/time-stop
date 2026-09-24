import { describe, expect, it } from 'vitest';
import { periodBounds } from '@app/domain';
import {
  dashboardSearchSchema,
  resolveSelection,
  toDashboardInput,
  toExportInput,
} from './dashboardSearch';
import { aProject } from '@/test/fixtures';

const context = { workspaceId: 'w1', projectId: 'p1' };
const today = new Date(2026, 8, 6, 12).toISOString();
const projects = [aProject({ id: 'p1' }), aProject({ id: 'p2' })];

describe('resolveSelection', () => {
  it('defaults to the current month in the Context Workspace, every Project, unrounded', () => {
    expect(resolveSelection({}, context, today, projects)).toEqual({
      period: 'month',
      anchor: '2026-09-06',
      ...periodBounds('month', today),
      workspace: 'w1',
      project: null,
      billable: false,
      rounding: 'none',
    });
  });

  it("takes explicit filters and options; the Workspace is always the Context's", () => {
    const view = resolveSelection(
      { period: 'week', anchor: '2026-08-31', project: 'p2', billable: true, rounding: '30m' },
      context,
      today,
      projects,
    );
    expect(view).toMatchObject({
      period: 'week',
      ...periodBounds('week', new Date(2026, 7, 31).toISOString()),
      workspace: 'w1',
      project: 'p2',
      billable: true,
      rounding: '30m',
    });
  });

  it('selects nothing for a Project outside the Context Workspace', () => {
    expect(resolveSelection({ project: 'p2' }, context, today, projects).project).toBe('p2');
    expect(resolveSelection({ project: 'p9' }, context, today, projects).project).toBe(null);
    expect(resolveSelection({ project: 'p2' }, context, today, []).project).toBe(null);
  });

  it('keeps the first id of a bookmarked multi-Project URL', () => {
    expect(resolveSelection({ project: 'p2,p3' }, context, today, projects).project).toBe('p2');
    expect(resolveSelection({ project: '' }, context, today, projects).project).toBe(null);
  });
});

describe('toDashboardInput', () => {
  it('always scopes to the Workspace and drops cleared filters', () => {
    const view = resolveSelection({}, context, today, projects);
    expect(toDashboardInput(view)).toEqual({ from: view.from, to: view.to, workspaceId: 'w1' });
    expect(toDashboardInput({ ...view, project: 'p1', billable: true })).toEqual({
      from: view.from,
      to: view.to,
      workspaceId: 'w1',
      projectIds: ['p1'],
      billable: true,
    });
  });
});

describe('toExportInput', () => {
  it('carries the Rounding alongside the view', () => {
    const view = resolveSelection({ rounding: '15m' }, context, today, projects);
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

  it('drops the client and workspace params the schema no longer has', () => {
    expect(dashboardSearchSchema.parse({ client: 'c1', workspace: 'w1', project: 'p1' })).toEqual({
      project: 'p1',
    });
  });
});
