import { amountOf, dayStart, hoursOf } from '@time-stop/domain';
import type { DashboardRow, Rounding } from '@time-stop/domain';
import type { Sort, SortKey } from './dashboardSearch';

export interface Day {
  start: string;
  rows: DashboardRow[];
}

const compareText = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });
const compareNumber = (a: number, b: number) => a - b;

/** Rows in the order the Dashboard shows them; Records tie-break by start, newest first. */
export function sortRows(
  rows: readonly DashboardRow[],
  { sort, dir }: Sort,
  now: number,
  rounding: Rounding,
): DashboardRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  const byStart = (a: DashboardRow, b: DashboardRow) => compareText(b.record.start, a.record.start);
  const compare = comparatorOf(sort, now, rounding);
  return [...rows].sort((a, b) => sign * compare(a, b) || byStart(a, b));
}

function comparatorOf(
  sort: SortKey,
  now: number,
  rounding: Rounding,
): (a: DashboardRow, b: DashboardRow) => number {
  switch (sort) {
    case 'start':
      return (a, b) => compareText(a.record.start, b.record.start);
    case 'name':
      return (a, b) => compareText(a.record.name, b.record.name);
    case 'project':
      return (a, b) => compareText(a.project?.name ?? '', b.project?.name ?? '');
    case 'duration':
      return (a, b) =>
        compareNumber(hoursOf(a.record, now, rounding), hoursOf(b.record, now, rounding));
    case 'amount':
      return (a, b) =>
        compareNumber(
          amountOf(a, hoursOf(a.record, now, rounding)) ?? -1,
          amountOf(b, hoursOf(b.record, now, rounding)) ?? -1,
        );
  }
}

/** Consecutive rows of one calendar day; meaningful only for rows already sorted by start. */
export function groupByDay(rows: readonly DashboardRow[]): Day[] {
  const days: Day[] = [];
  for (const row of rows) {
    const start = dayStart(row.record.start);
    const last = days[days.length - 1];
    if (last && last.start === start) last.rows.push(row);
    else days.push({ start, rows: [row] });
  }
  return days;
}
