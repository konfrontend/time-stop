import { z } from 'zod';
import { formatIsoDate, parseIsoDate, periodBounds, roundingSchema } from '@time-stop/domain';
import type {
  Context,
  DashboardInput,
  ExportReportInput,
  Period,
  Rounding,
} from '@time-stop/domain';

const billableFilterSchema = z.enum(['all', 'yes', 'no']);
export type BillableFilter = z.infer<typeof billableFilterSchema>;

/**
 * Everything the Dashboard shows lives here so back and bookmarks restore a view. An absent
 * `workspace` means "the Context's Workspace and Project"; `null` means every Workspace.
 */
export const dashboardSearchSchema = z.object({
  period: z.enum(['week', 'month']).optional(),
  anchor: z.iso.date().optional(),
  workspace: z.string().nullable().optional(),
  project: z.string().nullable().optional(),
  client: z.string().nullable().optional(),
  billable: billableFilterSchema.optional(),
  rounding: roundingSchema.optional(),
});
export type DashboardSearch = z.infer<typeof dashboardSearchSchema>;

export interface Filters {
  workspace: string | null;
  project: string | null;
  client: string | null;
  billable: BillableFilter;
}

/** The resolved Range (a Period around an anchor day) and filters the Dashboard shows. */
export interface DashboardSelection extends Filters {
  period: Period;
  anchor: string;
  from: string;
  to: string;
  // Export-only; it changes no row on screen.
  rounding: Rounding;
}

export function resolveSelection(
  search: DashboardSearch,
  context: Context,
  today: string,
): DashboardSelection {
  const period = search.period ?? 'month';
  const anchor = search.anchor ?? formatIsoDate(today);
  const fromContext = search.workspace === undefined;
  return {
    period,
    anchor,
    ...periodBounds(period, parseIsoDate(anchor)),
    workspace: fromContext ? context.workspaceId : (search.workspace ?? null),
    project: fromContext ? context.projectId : (search.project ?? null),
    client: search.client ?? null,
    billable: search.billable ?? 'all',
    rounding: search.rounding ?? 'none',
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

export function toExportInput(selection: DashboardSelection): ExportReportInput {
  return { ...toDashboardInput(selection), rounding: selection.rounding };
}

export function toDashboardInput(selection: DashboardSelection): DashboardInput {
  const input: DashboardInput = { from: selection.from, to: selection.to };
  if (selection.workspace) input.workspaceId = selection.workspace;
  if (selection.project) input.projectId = selection.project;
  if (selection.client) input.clientId = selection.client;
  if (selection.billable !== 'all') input.billable = selection.billable === 'yes';
  return input;
}
