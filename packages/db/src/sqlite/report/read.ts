import { buildReport } from '@time-stop/domain';
import type { ExportReportInput, Report } from '@time-stop/domain';
import { readDashboard } from '../dashboard/read.js';
import type { SqliteDb } from '../open.js';

export function readReport(
  db: SqliteDb,
  actorId: string,
  { rounding, ...input }: ExportReportInput,
  now: number,
): Report {
  const { rows } = readDashboard(db, actorId, input, now);
  return buildReport({ rows, from: input.from, to: input.to, rounding });
}
