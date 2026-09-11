import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { isBillable, periodBounds, recordDurationMs, totalsOf } from '@time-stop/domain';
import type { DashboardInput, DashboardRow, DashboardView, Project } from '@time-stop/domain';
import type { SqliteDb } from '../open.js';
import { clients, projects, records, workspaces } from '../schema.js';

const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((row) => [row.id, row]));

export function readDashboard(
  db: SqliteDb,
  actorId: string,
  input: DashboardInput,
  now: number,
): DashboardView {
  const started = db
    .select()
    .from(records)
    .where(
      and(
        eq(records.actorId, actorId),
        gte(records.start, input.from),
        lt(records.start, input.to),
      ),
    )
    .orderBy(desc(records.start))
    .all();
  const projectsById = byId(db.select().from(projects).all());
  const clientsById = byId(db.select().from(clients).all());
  const workspacesById = byId(db.select().from(workspaces).all());
  const usage = new Map<string, number>();

  function usedMs(project: Project, periodFrom: number, periodTo: number): number {
    const key = `${project.id}:${periodFrom}`;
    let used = usage.get(key);
    if (used === undefined) {
      used = db
        .select()
        .from(records)
        .where(
          and(
            eq(records.actorId, actorId),
            eq(records.projectId, project.id),
            gte(records.start, periodFrom),
            lt(records.start, periodTo),
          ),
        )
        .all()
        .reduce((sum, record) => sum + recordDurationMs(record, now), 0);
      usage.set(key, used);
    }
    return used;
  }

  const rows: DashboardRow[] = [];
  for (const record of started) {
    const project = record.projectId ? (projectsById.get(record.projectId) ?? null) : null;
    const client = project?.clientId ? (clientsById.get(project.clientId) ?? null) : null;
    if (input.workspaceId && record.workspaceId !== input.workspaceId) continue;
    if (input.projectId && record.projectId !== input.projectId) continue;
    if (input.clientId && client?.id !== input.clientId) continue;
    const currency = workspacesById.get(record.workspaceId)?.currency ?? null;
    if (input.billable !== undefined && isBillable({ project, currency }) !== input.billable) {
      continue;
    }

    let limits: DashboardRow['limits'] = null;
    if (project?.limitPeriod && (project.limitMin !== null || project.limitMax !== null)) {
      const { from, to } = periodBounds(project.limitPeriod, record.start);
      limits = {
        period: project.limitPeriod,
        usedMs: usedMs(project, from, to),
        min: project.limitMin,
        max: project.limitMax,
      };
    }
    rows.push({ record, project, client, currency, limits });
  }
  return { rows, totals: totalsOf(rows, now) };
}
