import { recordDurationMs } from '@app/domain';
import type { DashboardRow, Record } from '@app/domain';

/** One Project and one Name worked on; a Record without a Name is an activity of its own. */
export interface Activity {
  key: string;
  // Newest first; `rows[0]` is what Continue repeats.
  rows: DashboardRow[];
}

export function activityKey(record: Pick<Record, 'id' | 'name' | 'projectId'>): string {
  return record.name ? `${record.projectId ?? ''}|${record.name}` : record.id;
}

/** Keeps the order the Records arrive in, so activities read by last use. */
export function groupActivities(rows: DashboardRow[]): Activity[] {
  const byKey = new Map<string, Activity>();
  for (const row of rows) {
    const key = activityKey(row.record);
    const activity = byKey.get(key);
    if (activity) activity.rows.push(row);
    else byKey.set(key, { key, rows: [row] });
  }
  return [...byKey.values()];
}

/** How much time a set of rows holds together. */
export function totalDurationMs(rows: DashboardRow[], now: number): number {
  return rows.reduce((sum, row) => sum + recordDurationMs(row.record, now), 0);
}
