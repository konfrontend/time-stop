import { z } from 'zod';
import { formatIsoDate, parseIsoDate, periodBounds, roundingSchema } from '@time-stop/domain';
import type {
  Context,
  DashboardInput,
  ExportReportInput,
  Period,
  Rounding,
} from '@time-stop/domain';

export const sortKeySchema = z.enum(['start', 'name', 'project', 'duration', 'amount']);
export type SortKey = z.infer<typeof sortKeySchema>;
export const sortDirSchema = z.enum(['asc', 'desc']);
export type SortDir = z.infer<typeof sortDirSchema>;

/**
 * Everything the Dashboard shows lives here so back and bookmarks restore a view. An absent
 * `workspace` means "the Context's Workspace and Project"; `project` is a comma list of ids.
 */
export const dashboardSearchSchema = z.object({
  period: z.enum(['week', 'month']).optional(),
  anchor: z.iso.date().optional(),
  workspace: z.string().optional(),
  project: z.string().optional(),
  client: z.string().optional(),
  billable: z.literal(true).optional(),
  rounding: roundingSchema.optional(),
  sort: sortKeySchema.optional(),
  dir: sortDirSchema.optional(),
});
export type DashboardSearch = z.infer<typeof dashboardSearchSchema>;

export interface Filters {
  projects: string[];
  client: string | null;
  // True shows Billable Records only.
  billable: boolean;
}

export interface Sort {
  sort: SortKey;
  dir: SortDir;
}

/** The resolved Range (a Period around an anchor day), Workspace, filters and options shown. */
export interface DashboardSelection extends Filters, Sort {
  period: Period;
  anchor: string;
  from: string;
  to: string;
  workspace: string;
  rounding: Rounding;
}

const parseList = (text: string | undefined): string[] => (text ? text.split(',') : []);

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
    workspace: search.workspace ?? context.workspaceId,
    projects: fromContext
      ? context.projectId
        ? [context.projectId]
        : []
      : parseList(search.project),
    client: search.client ?? null,
    billable: search.billable ?? false,
    rounding: search.rounding ?? 'none',
    sort: search.sort ?? 'start',
    dir: search.dir ?? 'desc',
  };
}

/** Search params for a filter change; defaults leave the URL. */
export function filtersToSearch(
  filters: Filters,
): Pick<DashboardSearch, 'project' | 'client' | 'billable'> {
  return {
    project: filters.projects.length > 0 ? filters.projects.join(',') : undefined,
    client: filters.client ?? undefined,
    billable: filters.billable || undefined,
  };
}

export function sortToSearch(sort: Sort): Pick<DashboardSearch, 'sort' | 'dir'> {
  const isDefault = sort.sort === 'start' && sort.dir === 'desc';
  return isDefault ? { sort: undefined, dir: undefined } : sort;
}

export function toExportInput(selection: DashboardSelection): ExportReportInput {
  return { ...toDashboardInput(selection), rounding: selection.rounding };
}

export function toDashboardInput(selection: DashboardSelection): DashboardInput {
  const input: DashboardInput = {
    from: selection.from,
    to: selection.to,
    workspaceId: selection.workspace,
  };
  if (selection.projects.length > 0) input.projectIds = selection.projects;
  if (selection.client) input.clientId = selection.client;
  if (selection.billable) input.billable = true;
  return input;
}
