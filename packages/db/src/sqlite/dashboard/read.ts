import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { isBillable, periodBounds, recordDurationMs } from '@time-stop/domain';
import type {
  DashboardInput,
  DashboardRow,
  Project,
  RecentRowsInput,
  Record,
} from '@time-stop/domain';
import type { SqliteDb } from '../open.js';
import { clients, projects, records, workspaces } from '../schema.js';

const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((row) => [row.id, row]));

/** Limits usage is memoized per Project and Period across the Records it derives. */
function rowDeriver(db: SqliteDb, actorId: string, now: number) {
  const projectsById = byId(db.select().from(projects).all());
  const clientsById = byId(db.select().from(clients).all());
  const workspacesById = byId(db.select().from(workspaces).all());
  const usage = new Map<string, number>();

  function usedMs(project: Project, periodFrom: string, periodTo: string): number {
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

  return (record: Record): DashboardRow => {
    const project = record.projectId ? (projectsById.get(record.projectId) ?? null) : null;
    const client = project?.clientId ? (clientsById.get(project.clientId) ?? null) : null;
    const currency = workspacesById.get(record.workspaceId)?.currency ?? null;
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
    return { record, project, client, currency, limits };
  };
}

export function readDashboard(
  db: SqliteDb,
  actorId: string,
  input: DashboardInput,
  now: number,
): DashboardRow[] {
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
  const derive = rowDeriver(db, actorId, now);
  const projectIds = input.projectIds?.length ? new Set(input.projectIds) : null;

  const rows: DashboardRow[] = [];
  for (const record of started) {
    if (input.workspaceId && record.workspaceId !== input.workspaceId) continue;
    if (projectIds && (record.projectId === null || !projectIds.has(record.projectId))) continue;
    const row = derive(record);
    if (input.clientId && row.client?.id !== input.clientId) continue;
    if (
      input.billable !== undefined &&
      isBillable({ project: row.project, currency: row.currency }) !== input.billable
    ) {
      continue;
    }
    rows.push(row);
  }
  return rows;
}

export function readRecentRows(
  db: SqliteDb,
  actorId: string,
  { workspaceId, projectId, limit }: RecentRowsInput,
  now: number,
): DashboardRow[] {
  const conditions = [eq(records.actorId, actorId), eq(records.workspaceId, workspaceId)];
  if (projectId) conditions.push(eq(records.projectId, projectId));
  const latest = db
    .select()
    .from(records)
    .where(and(...conditions))
    .orderBy(desc(records.start))
    .limit(limit)
    .all();
  return latest.map(rowDeriver(db, actorId, now));
}
