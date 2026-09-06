import { z } from 'zod';
import { formatIsoDate, parseIsoDate, periodBounds } from '@time-stop/domain';
import type { Context, DashboardInput, Period } from '@time-stop/domain';

const billableFilterSchema = z.enum(['all', 'yes', 'no']);
export type BillableFilter = z.infer<typeof billableFilterSchema>;

/**
 * Everything the Dashboard shows lives here so back and bookmarks restore a view. An absent
 * `workspace` means "the Context's Workspace and Project"; `null` means every Workspace.
 */
export const dashboardSearchSchema = z.object({
  range: z.enum(['week', 'month']).optional(),
  anchor: z.iso.date().optional(),
  workspace: z.string().nullable().optional(),
  project: z.string().nullable().optional(),
  client: z.string().nullable().optional(),
  billable: billableFilterSchema.optional(),
});
export type DashboardSearch = z.infer<typeof dashboardSearchSchema>;

export interface Filters {
  workspace: string | null;
  project: string | null;
  client: string | null;
  billable: BillableFilter;
}

export interface DashboardView extends Filters {
  range: Period;
  anchor: string;
  from: number;
  to: number;
}

export function resolveDashboardView(
  search: DashboardSearch,
  context: Context,
  today: number,
): DashboardView {
  const range = search.range ?? 'month';
  const anchor = search.anchor ?? formatIsoDate(today);
  const fromContext = search.workspace === undefined;
  return {
    range,
    anchor,
    ...periodBounds(range, parseIsoDate(anchor)),
    workspace: fromContext ? context.workspaceId : (search.workspace ?? null),
    project: fromContext ? context.projectId : (search.project ?? null),
    client: search.client ?? null,
    billable: search.billable ?? 'all',
  };
}

/** Search params for a filter change; `null` stays only where it means "all Workspaces". */
export function filtersToSearch(
  filters: Filters,
): Pick<DashboardSearch, 'workspace' | 'project' | 'client' | 'billable'> {
  return {
    workspace: filters.workspace,
    project: filters.project ?? undefined,
    client: filters.client ?? undefined,
    billable: filters.billable === 'all' ? undefined : filters.billable,
  };
}

export function toDashboardInput(view: DashboardView): DashboardInput {
  const input: DashboardInput = { from: view.from, to: view.to };
  if (view.workspace) input.workspaceId = view.workspace;
  if (view.project) input.projectId = view.project;
  if (view.client) input.clientId = view.client;
  if (view.billable !== 'all') input.billable = view.billable === 'yes';
  return input;
}
