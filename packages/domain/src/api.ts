import { z, type ZodType } from 'zod';
import { epochMs, idSchema, limitPeriodSchema } from './entities.js';
import type { Client, Project, Record, Workspace } from './entities.js';
import type { DashboardView } from './dashboard.js';
import type { Report, Rounding } from './report.js';
import { serverInputSchema } from './sync.js';
import type { ServerInput, ServerSettings, SyncListener, SyncStatus } from './sync.js';

export const idInputSchema = z.object({ id: idSchema });
export type IdInput = z.infer<typeof idInputSchema>;

const name = z.string().trim().min(1).max(200);

export const workspaceInputSchema = z.object({
  name,
  currency: z
    .string()
    .trim()
    .max(20)
    .transform((s) => s || null)
    .nullable(),
});
export type WorkspaceInput = z.infer<typeof workspaceInputSchema>;
export const updateWorkspaceInputSchema = workspaceInputSchema.extend({ id: idSchema });
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceInputSchema>;

export const clientInputSchema = z.object({ workspaceId: idSchema, name });
export type ClientInput = z.infer<typeof clientInputSchema>;
export const updateClientInputSchema = z.object({ id: idSchema, name });
export type UpdateClientInput = z.infer<typeof updateClientInputSchema>;

const projectFields = {
  clientId: idSchema.nullable(),
  name,
  rate: z.number().nonnegative().nullable(),
  limitMin: z.number().nonnegative().nullable(),
  limitMax: z.number().nonnegative().nullable(),
  limitPeriod: limitPeriodSchema.nullable(),
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color is a hex value like #4f6bd9'),
};

export function checkProject(
  project: {
    limitMin: number | null;
    limitMax: number | null;
    limitPeriod: 'week' | 'month' | null;
    startDate: string | null;
    endDate: string | null;
  },
  ctx: z.RefinementCtx,
): void {
  const hasLimit = project.limitMin !== null || project.limitMax !== null;
  if (hasLimit && project.limitPeriod === null) {
    ctx.addIssue({ code: 'custom', path: ['limitPeriod'], message: 'Limits need a Period' });
  }
  if (
    project.limitMin !== null &&
    project.limitMax !== null &&
    project.limitMin > project.limitMax
  ) {
    ctx.addIssue({ code: 'custom', path: ['limitMax'], message: 'Max must not be below Min' });
  }
  if (project.startDate && project.endDate && project.startDate > project.endDate) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End must not precede start' });
  }
}

export const projectInputSchema = z
  .object({ workspaceId: idSchema, ...projectFields })
  .superRefine(checkProject);
export type ProjectInput = z.infer<typeof projectInputSchema>;
export const updateProjectInputSchema = z
  .object({ id: idSchema, ...projectFields })
  .superRefine(checkProject);
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;

export const listClientsInputSchema = z.object({ workspaceId: idSchema.optional() });
export type ListClientsInput = z.infer<typeof listClientsInputSchema>;

export const listProjectsInputSchema = z.object({
  workspaceId: idSchema.optional(),
  archived: z.boolean().optional(),
});
export type ListProjectsInput = z.infer<typeof listProjectsInputSchema>;

export const countRecordsInputSchema = z.object({
  workspaceId: idSchema.optional(),
  projectId: idSchema.optional(),
});
export type CountRecordsInput = z.infer<typeof countRecordsInputSchema>;

export const contextSchema = z.object({ workspaceId: idSchema, projectId: idSchema.nullable() });
export type Context = z.infer<typeof contextSchema>;

export const updateRecordNameInputSchema = z.object({
  id: idSchema,
  name: z.string().max(500),
});
export type UpdateRecordNameInput = z.infer<typeof updateRecordNameInputSchema>;

const recordFields = {
  projectId: idSchema.nullable(),
  name: z.string().max(500),
  start: epochMs,
};

export function checkRecordSpan(
  record: { start: number; stop: number | null },
  ctx: z.RefinementCtx,
): void {
  if (record.stop !== null && record.stop < record.start) {
    ctx.addIssue({ code: 'custom', path: ['stop'], message: 'Stop must not precede start' });
  }
}

export const createRecordInputSchema = z
  .object({
    workspaceId: idSchema,
    ...recordFields,
    stop: epochMs,
    billable: z.boolean().optional(),
  })
  .superRefine(checkRecordSpan);
export type CreateRecordInput = z.infer<typeof createRecordInputSchema>;

export const updateRecordInputSchema = z
  .object({ id: idSchema, ...recordFields, stop: epochMs.nullable(), billable: z.boolean() })
  .superRefine(checkRecordSpan);
export type UpdateRecordInput = z.infer<typeof updateRecordInputSchema>;

export const listRecentNamesInputSchema = z.object({ projectId: idSchema.nullable() });
export type ListRecentNamesInput = z.infer<typeof listRecentNamesInputSchema>;

/** The Range: `from` inclusive, `to` exclusive. */
const range = { from: epochMs, to: epochMs };
const rangeInOrder = (input: { from: number; to: number }) => input.from <= input.to;

export const listRecordsInputSchema = z
  .object(range)
  .refine(rangeInOrder, 'from must not exceed to');
export type ListRecordsInput = z.infer<typeof listRecordsInputSchema>;

/** Range plus the four Dashboard filters; an absent filter means "all". */
const dashboardFields = {
  ...range,
  workspaceId: idSchema.optional(),
  projectId: idSchema.optional(),
  clientId: idSchema.optional(),
  billable: z.boolean().optional(),
};

export const dashboardInputSchema = z
  .object(dashboardFields)
  .refine(rangeInOrder, 'from must not exceed to');
export type DashboardInput = z.infer<typeof dashboardInputSchema>;

export const roundingSchema = z.enum(['none', '15m']) satisfies z.ZodType<Rounding>;

/** The Dashboard view to report on, plus the Rounding chosen at Export. */
export const exportReportInputSchema = z
  .object({ ...dashboardFields, rounding: roundingSchema })
  .refine(rangeInOrder, 'from must not exceed to');
export type ExportReportInput = z.infer<typeof exportReportInputSchema>;

export const setRecordBillableInputSchema = z.object({ id: idSchema, billable: z.boolean() });
export type SetRecordBillableInput = z.infer<typeof setRecordBillableInputSchema>;

export type TimerListener = (timer: Record | null) => void;
export type ContextListener = (context: Context) => void;

export interface TimeStopApi {
  // Oldest first; the first is the default Workspace.
  listWorkspaces(): Promise<Workspace[]>;
  createWorkspace(input: WorkspaceInput): Promise<Workspace>;
  updateWorkspace(input: UpdateWorkspaceInput): Promise<Workspace>;
  // Takes the Workspace's Clients, Projects and Records with it; the default Workspace stays.
  deleteWorkspace(input: IdInput): Promise<void>;

  listClients(input?: ListClientsInput): Promise<Client[]>;
  createClient(input: ClientInput): Promise<Client>;
  updateClient(input: UpdateClientInput): Promise<Client>;
  // Projects of the Client lose their Client reference.
  deleteClient(input: IdInput): Promise<void>;

  listProjects(input?: ListProjectsInput): Promise<Project[]>;
  createProject(input: ProjectInput): Promise<Project>;
  // The Rate applies to new Records only.
  updateProject(input: UpdateProjectInput): Promise<Project>;
  archiveProject(input: IdInput): Promise<Project>;
  unarchiveProject(input: IdInput): Promise<Project>;
  // Records of the Project keep their Workspace and lose the Project reference.
  deleteProject(input: IdInput): Promise<void>;

  // For the delete confirmation: how many Records a Workspace or Project still holds.
  countRecords(input: CountRecordsInput): Promise<number>;

  getContext(): Promise<Context>;
  // A Project from another Workspace is dropped rather than kept.
  setContext(input: Context): Promise<Context>;

  // Lands in the Context; stops the running Timer first, at the new one's start.
  startTimer(): Promise<Record>;
  stopTimer(): Promise<Record | null>;
  getTimer(): Promise<Record | null>;
  updateRecordName(input: UpdateRecordNameInput): Promise<Record>;
  /**
   * A Project must sit in the given Workspace; without one the Rate stays clear. Billable
   * defaults to the Record having a Rate.
   */
  createRecord(input: CreateRecordInput): Promise<Record>;
  /**
   * A new Project re-derives the Workspace and re-snapshots the Rate; no Project keeps the
   * Workspace and clears the Rate. Only the Timer may keep an empty stop.
   */
  updateRecord(input: UpdateRecordInput): Promise<Record>;
  deleteRecord(input: IdInput): Promise<void>;
  // Most recently started first.
  listRecentNames(input: ListRecentNamesInput): Promise<string[]>;
  // Newest first.
  listRecords(input: ListRecordsInput): Promise<Record[]>;
  setRecordBillable(input: SetRecordBillableInput): Promise<Record>;
  /**
   * Records started in the Range that pass the filters, with Overlap, Client, Currency and Limits
   * usage derived, plus totals at the time of the call. Overlap looks at every Record of the
   * Actor that touches the Range, filtered or not.
   */
  getDashboard(input: DashboardInput): Promise<DashboardView>;
  exportReport(input: ExportReportInput): Promise<Report>;
  // Fires whenever a write leaves the Timer different in any field: start, stop, a Name edit…
  subscribeTimer(listener: TimerListener): () => void;
  // Fires whenever a write moves the Context's Workspace or Project.
  subscribeContext(listener: ContextListener): () => void;

  getServer(): Promise<ServerSettings>;
  /** Replacing the Token clears a halt and resumes pushing; an empty URL stops the mirror. */
  setServer(input: ServerInput): Promise<ServerSettings>;
  getSyncStatus(): Promise<SyncStatus>;
  // Fires whenever the push state moves: a batch lands, the queue grows, an error arrives.
  subscribeSync(listener: SyncListener): () => void;
}

type Method<Api> = {
  [M in keyof Api]: Api[M] extends (...args: never[]) => Promise<unknown> ? M : never;
}[keyof Api];
type Subscription<Api> = {
  [M in keyof Api]: Api[M] extends (listener: never) => () => void ? M : never;
}[keyof Api];
type InputSchema<Fn> = Fn extends (...args: infer Args) => unknown
  ? Args extends []
    ? undefined
    : ZodType<Args[number]>
  : never;

/**
 * Every invokable method of an api mapped to its input schema (`undefined` when it takes none);
 * an extra or a missing method fails typecheck. Transports register handlers and build bridges
 * from it, so adding a method is one table entry plus its implementation.
 */
export type MethodTable<Api> = { [M in Method<Api>]: InputSchema<Api[M]> };
/** Every subscribe method of an api mapped to the event it listens for. */
export type EventTable<Api> = { [M in Subscription<Api>]: string };

export type MethodInput<Api, M extends keyof Api> = Api[M] extends (...args: infer Args) => unknown
  ? Args[number]
  : never;
/** What a subscription hands its listener. */
export type EventValue<Api, M extends keyof Api> = Api[M] extends (
  listener: (value: infer Value) => void,
) => () => void
  ? Value
  : never;

export const apiMethods = {
  listWorkspaces: undefined,
  createWorkspace: workspaceInputSchema,
  updateWorkspace: updateWorkspaceInputSchema,
  deleteWorkspace: idInputSchema,
  listClients: listClientsInputSchema.optional(),
  createClient: clientInputSchema,
  updateClient: updateClientInputSchema,
  deleteClient: idInputSchema,
  listProjects: listProjectsInputSchema.optional(),
  createProject: projectInputSchema,
  updateProject: updateProjectInputSchema,
  archiveProject: idInputSchema,
  unarchiveProject: idInputSchema,
  deleteProject: idInputSchema,
  countRecords: countRecordsInputSchema,
  getContext: undefined,
  setContext: contextSchema,
  startTimer: undefined,
  stopTimer: undefined,
  getTimer: undefined,
  updateRecordName: updateRecordNameInputSchema,
  createRecord: createRecordInputSchema,
  updateRecord: updateRecordInputSchema,
  deleteRecord: idInputSchema,
  listRecentNames: listRecentNamesInputSchema,
  listRecords: listRecordsInputSchema,
  setRecordBillable: setRecordBillableInputSchema,
  getDashboard: dashboardInputSchema,
  exportReport: exportReportInputSchema,
  getServer: undefined,
  setServer: serverInputSchema,
  getSyncStatus: undefined,
} satisfies MethodTable<TimeStopApi>;

export const apiEvents = {
  subscribeTimer: 'timerChanged',
  subscribeSync: 'syncChanged',
  subscribeContext: 'contextChanged',
} satisfies EventTable<TimeStopApi>;
