import { buildReport } from '@time-stop/domain';
import type { ExportReportInput, Report } from '@time-stop/domain';
import { readDashboard } from './dashboard.js';
import type { SqliteDb } from './open.js';
import { workspaces } from './schema.js';

/** The Report of a Dashboard view: the same rows, with the Workspace Names the filename needs. */
export function readReport(
  db: SqliteDb,
  actorId: string,
  { rounding, ...input }: ExportReportInput,
  now: number,
): Report {
  const names = new Map(
    db
      .select()
      .from(workspaces)
      .all()
      .map((w) => [w.id, w.name]),
  );
  const { rows } = readDashboard(db, actorId, input, now);
  return buildReport({
    rows: rows.map((row) => ({ ...row, workspace: names.get(row.record.workspaceId) ?? null })),
    from: input.from,
    to: input.to,
    rounding,
  });
}
