import { z } from 'zod';
import { epochMs, idSchema, limitPeriodSchema } from './entities.js';
import type { Client, Project, Record, Workspace } from './entities.js';

export const idInputSchema = z.object({ id: idSchema });
export type IdInput = z.infer<typeof idInputSchema>;

const name = z.string().trim().min(1).max(200);

export const workspaceInputSchema = z.object({
  name,
  // ISO 4217 code.
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Currency is a three-letter code'),
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

export const listRecordsInputSchema = z
  .object({
    // Inclusive.
    from: epochMs,
    // Exclusive.
    to: epochMs,
  })
  .refine((range) => range.from <= range.to, 'from must not exceed to');
export type ListRecordsInput = z.infer<typeof listRecordsInputSchema>;

export type TimerListener = (timer: Record | null) => void;

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
  // Newest first.
  listRecords(input: ListRecordsInput): Promise<Record[]>;
  // Fires after start, stop and Name edits of the Timer.
  subscribeTimer(listener: TimerListener): () => void;
}
