import { ipcMain, webContents, type IpcMainInvokeEvent } from 'electron';
import { z, type ZodType } from 'zod';
import {
  clientInputSchema,
  contextSchema,
  countRecordsInputSchema,
  idInputSchema,
  listClientsInputSchema,
  listProjectsInputSchema,
  listRecordsInputSchema,
  projectInputSchema,
  updateClientInputSchema,
  updateProjectInputSchema,
  updateRecordNameInputSchema,
  updateWorkspaceInputSchema,
  workspaceInputSchema,
} from '@time-stop/domain';
import type { TimeStopApi } from '@time-stop/domain';
import { channels } from '../shared/channels.js';

function handle<Input>(
  channel: string,
  schema: ZodType<Input>,
  run: (input: Input) => Promise<unknown>,
): void {
  ipcMain.handle(channel, (_event: IpcMainInvokeEvent, raw: unknown) => run(schema.parse(raw)));
}

export function registerIpc(api: TimeStopApi): () => void {
  const none = z.undefined();
  handle(channels.listWorkspaces, none, () => api.listWorkspaces());
  handle(channels.createWorkspace, workspaceInputSchema, (i) => api.createWorkspace(i));
  handle(channels.updateWorkspace, updateWorkspaceInputSchema, (i) => api.updateWorkspace(i));
  handle(channels.deleteWorkspace, idInputSchema, (i) => api.deleteWorkspace(i));
  handle(channels.listClients, listClientsInputSchema.optional(), (i) => api.listClients(i));
  handle(channels.createClient, clientInputSchema, (i) => api.createClient(i));
  handle(channels.updateClient, updateClientInputSchema, (i) => api.updateClient(i));
  handle(channels.deleteClient, idInputSchema, (i) => api.deleteClient(i));
  handle(channels.listProjects, listProjectsInputSchema.optional(), (i) => api.listProjects(i));
  handle(channels.createProject, projectInputSchema, (i) => api.createProject(i));
  handle(channels.updateProject, updateProjectInputSchema, (i) => api.updateProject(i));
  handle(channels.archiveProject, idInputSchema, (i) => api.archiveProject(i));
  handle(channels.unarchiveProject, idInputSchema, (i) => api.unarchiveProject(i));
  handle(channels.deleteProject, idInputSchema, (i) => api.deleteProject(i));
  handle(channels.countRecords, countRecordsInputSchema, (i) => api.countRecords(i));
  handle(channels.getContext, none, () => api.getContext());
  handle(channels.setContext, contextSchema, (i) => api.setContext(i));
  handle(channels.startTimer, none, () => api.startTimer());
  handle(channels.stopTimer, none, () => api.stopTimer());
  handle(channels.getTimer, none, () => api.getTimer());
  handle(channels.updateRecordName, updateRecordNameInputSchema, (i) => api.updateRecordName(i));
  handle(channels.listRecords, listRecordsInputSchema, (i) => api.listRecords(i));

  const unsubscribe = api.subscribeTimer((timer) => {
    for (const contents of webContents.getAllWebContents()) {
      contents.send(channels.timerChanged, timer);
    }
  });

  return () => {
    unsubscribe();
    for (const channel of Object.values(channels)) ipcMain.removeHandler(channel);
  };
}
