import { z } from 'zod';
import { formatIsoDate, parseIsoDate, periodBounds, roundingSchema } from '@app/domain';
import type {
  Context,
  DashboardInput,
  ExportReportInput,
  Period,
  Project,
  Rounding,
} from '@app/domain';

/**
 * The Dashboard's view state, kept in the URL: the Range, one Project, the filters and options.
 * The Workspace is never here; the Dashboard shows the Context's.
 */
export const dashboardSearchSchema = z.object({
  period: z.enum(['week', 'month']).optional(),
  anchor: z.iso.date().optional(),
  project: z.string().optional(),
  billable: z.literal(true).optional(),
  rounding: roundingSchema.optional(),
});
export type DashboardSearch = z.infer<typeof dashboardSearchSchema>;

/** The resolved Range (a Period around an anchor day), Workspace, filters and options shown. */
export interface DashboardSelection {
  period: Period;
  // Any day in the Range, `YYYY-MM-DD`.
  anchor: string;
  from: string;
  to: string;
  workspace: string;
  project: string | null;
  // True shows Billable Records only.
  billable: boolean;
  rounding: Rounding;
}

// A comma list in `project` narrows to its first id.
const firstId = (text: string | undefined): string | null => text?.split(',')[0] || null;

/**
 * `projects` are the Context Workspace's; a `project` outside them (left over from a Workspace the
 * Context has moved away from) selects nothing.
 */
export function resolveSelection(
  search: DashboardSearch,
  context: Context,
  today: string,
  projects: readonly Project[],
): DashboardSelection {
  const period = search.period ?? 'month';
  const anchor = search.anchor ?? formatIsoDate(today);
  const project = firstId(search.project);
  return {
    period,
    anchor,
    ...periodBounds(period, parseIsoDate(anchor)),
    workspace: context.workspaceId,
    project: project && projects.some(({ id }) => id === project) ? project : null,
    billable: search.billable ?? false,
    rounding: search.rounding ?? 'none',
  };
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
  if (selection.project) input.projectIds = [selection.project];
  if (selection.billable) input.billable = true;
  return input;
}
