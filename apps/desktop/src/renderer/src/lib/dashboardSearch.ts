import { z } from 'zod';
import { formatIsoDate, parseIsoDate, periodBounds, roundingSchema } from '@time-stop/domain';
import type {
  Context,
  DashboardInput,
  ExportReportInput,
  Period,
  Rounding,
} from '@time-stop/domain';

/**
 * Everything the Dashboard shows lives here so back and bookmarks restore a view. An absent
 * `workspace` means "the Context's Workspace"; `project` is one id.
 */
export const dashboardSearchSchema = z.object({
  period: z.enum(['week', 'month']).optional(),
  anchor: z.iso.date().optional(),
  workspace: z.string().optional(),
  project: z.string().optional(),
  billable: z.literal(true).optional(),
  rounding: roundingSchema.optional(),
});
export type DashboardSearch = z.infer<typeof dashboardSearchSchema>;

/** The resolved Range (a Period around an anchor day), Workspace, filters and options shown. */
export interface DashboardSelection {
  period: Period;
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

export function resolveSelection(
  search: DashboardSearch,
  context: Context,
  today: string,
): DashboardSelection {
  const period = search.period ?? 'month';
  const anchor = search.anchor ?? formatIsoDate(today);
  return {
    period,
    anchor,
    ...periodBounds(period, parseIsoDate(anchor)),
    workspace: search.workspace ?? context.workspaceId,
    project: firstId(search.project),
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
