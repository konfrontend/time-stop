import type { DashboardRow } from '@time-stop/domain';

/** Rows in the order the Dashboard shows them: newest start first. */
export function sortByStart(rows: readonly DashboardRow[]): DashboardRow[] {
  return [...rows].sort((a, b) => b.record.start.localeCompare(a.record.start));
}
