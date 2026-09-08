import type { Client, Context, Project, TimeStopApi, Workspace } from '@time-stop/domain';
import type { TogglEntry } from './togglCsv.js';

export interface ImportOptions {
  /** The Workspace to import into, by id; it must exist. Takes precedence over the name. */
  workspaceId?: string;
  /** The Workspace to import into, by name; created when no Workspace carries it. */
  workspaceName?: string;
}

export interface ImportSummary {
  workspaceId: string;
  workspaces: number;
  clients: number;
  projects: number;
  records: number;
  /** Entries the import passed over: a running entry, or a Record already present. */
  skipped: number;
}

const HOUR = 3_600_000;

/** Toggl exports carry no color, so a Project keeps the same one on every run. */
const COLORS = [
  '#4f6bd9',
  '#c2410c',
  '#0f766e',
  '#7c3aed',
  '#b91c1c',
  '#0369a1',
  '#4d7c0f',
  '#a16207',
];

function colorOf(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) % 1_000_003;
  return COLORS[hash % COLORS.length]!;
}

/**
 * The hourly Rate the export implies: the first Amount over the hours it was billed for. Toggl
 * bills its own duration, which a rounded export leaves shorter than the span of the entry.
 */
function rateOf(entries: TogglEntry[]): number | null {
  for (const entry of entries) {
    if (entry.amount === null) continue;
    const billed = entry.duration ?? (entry.stop === null ? null : entry.stop - entry.start);
    if (billed !== null && billed > 0)
      return Math.round((entry.amount / (billed / HOUR)) * 100) / 100;
  }
  return null;
}

function recordKey(start: number, stop: number, projectId: string | null, name: string): string {
  return [start, stop, projectId ?? '', name].join('|');
}

function groupByProject(entries: TogglEntry[]): Map<string, TogglEntry[]> {
  const groups = new Map<string, TogglEntry[]>();
  for (const entry of entries) {
    if (entry.project === null) continue;
    const group = groups.get(entry.project);
    if (group) group.push(entry);
    else groups.set(entry.project, [entry]);
  }
  return groups;
}

async function targetWorkspace(
  api: TimeStopApi,
  entries: TogglEntry[],
  { workspaceId, workspaceName: name }: ImportOptions,
): Promise<{ workspace: Workspace; created: boolean }> {
  const workspaces = await api.listWorkspaces();
  if (workspaceId !== undefined) {
    const chosen = workspaces.find((workspace) => workspace.id === workspaceId);
    if (!chosen) throw new Error(`Workspace ${workspaceId} not found`);
    return { workspace: chosen, created: false };
  }
  if (name === undefined) {
    const [fallback] = workspaces;
    if (!fallback) throw new Error('No Workspace; the database was not bootstrapped');
    return { workspace: fallback, created: false };
  }
  const existing = workspaces.find((workspace) => workspace.name === name);
  if (existing) return { workspace: existing, created: false };
  const currency = entries.find((entry) => entry.currency !== null)?.currency ?? null;
  return { workspace: await api.createWorkspace({ name, currency }), created: true };
}

async function importClients(
  api: TimeStopApi,
  workspaceId: string,
  entries: TogglEntry[],
): Promise<{ byName: Map<string, Client>; created: number }> {
  const byName = new Map(
    (await api.listClients({ workspaceId })).map((client) => [client.name, client]),
  );
  let created = 0;
  for (const entry of entries) {
    if (entry.client === null || byName.has(entry.client)) continue;
    byName.set(entry.client, await api.createClient({ workspaceId, name: entry.client }));
    created += 1;
  }
  return { byName, created };
}

async function importProjects(
  api: TimeStopApi,
  workspaceId: string,
  entries: TogglEntry[],
  clients: Map<string, Client>,
): Promise<{ byName: Map<string, Project>; created: number }> {
  const byName = new Map(
    (await api.listProjects({ workspaceId })).map((project) => [project.name, project]),
  );
  let created = 0;
  for (const [name, group] of groupByProject(entries)) {
    if (byName.has(name)) continue;
    const client = group.find((entry) => entry.client !== null)?.client ?? null;
    byName.set(
      name,
      await api.createProject({
        workspaceId,
        clientId: client === null ? null : (clients.get(client)?.id ?? null),
        name,
        rate: rateOf(group),
        limitMin: null,
        limitMax: null,
        limitPeriod: null,
        startDate: null,
        endDate: null,
        color: colorOf(name),
      }),
    );
    created += 1;
  }
  return { byName, created };
}

async function existingKeys(
  api: TimeStopApi,
  workspaceId: string,
  entries: TogglEntry[],
): Promise<Set<string>> {
  const starts = entries.map((entry) => entry.start);
  if (starts.length === 0) return new Set();
  const records = await api.listRecords({
    from: Math.min(...starts),
    to: Math.max(...starts) + 1,
  });
  return new Set(
    records
      .filter((record) => record.stop !== null && record.workspaceId === workspaceId)
      .map((record) => recordKey(record.start, record.stop!, record.projectId, record.name)),
  );
}

/** An Archived Project refuses to be the Context again, so the Workspace alone comes back. */
async function restoreContext(api: TimeStopApi, context: Context): Promise<void> {
  try {
    await api.setContext(context);
  } catch {
    await api.setContext({ ...context, projectId: null });
  }
}

/**
 * Writes a Toggl export into a Time Stop database through the app's own api, so every entity
 * lands with its Change. Entries already present are passed over, making a rerun a no-op.
 */
export async function importToggl(
  api: TimeStopApi,
  entries: TogglEntry[],
  options: ImportOptions = {},
): Promise<ImportSummary> {
  const { workspace, created } = await targetWorkspace(api, entries, options);
  const clients = await importClients(api, workspace.id, entries);
  const projects = await importProjects(api, workspace.id, entries, clients.byName);

  const context = await api.getContext();
  await api.setContext({ workspaceId: workspace.id, projectId: null });
  try {
    const seen = await existingKeys(api, workspace.id, entries);
    let records = 0;
    let skipped = 0;
    for (const entry of entries) {
      if (entry.stop === null) {
        skipped += 1;
        continue;
      }
      const projectId =
        entry.project === null ? null : (projects.byName.get(entry.project)?.id ?? null);
      const key = recordKey(entry.start, entry.stop, projectId, entry.name);
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      const record = await api.createRecord({
        projectId,
        name: entry.name,
        start: entry.start,
        stop: entry.stop,
      });
      if (record.billable !== entry.billable) {
        await api.setRecordBillable({ id: record.id, billable: entry.billable });
      }
      seen.add(key);
      records += 1;
    }
    return {
      workspaceId: workspace.id,
      workspaces: created ? 1 : 0,
      clients: clients.created,
      projects: projects.created,
      records,
      skipped,
    };
  } finally {
    await restoreContext(api, context);
  }
}
