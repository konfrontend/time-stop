import { ipcMain, webContents, type IpcMainInvokeEvent } from 'electron';
import { z, type ZodType } from 'zod';
import {
  clientInputSchema,
  contextSchema,
  countRecordsInputSchema,
  createRecordInputSchema,
  dashboardInputSchema,
  exportReportInputSchema,
  idInputSchema,
  listClientsInputSchema,
  listProjectsInputSchema,
  listRecentNamesInputSchema,
  listRecordsInputSchema,
  projectInputSchema,
  serverInputSchema,
  setRecordBillableInputSchema,
  updateClientInputSchema,
  updateProjectInputSchema,
  updateRecordInputSchema,
  updateRecordNameInputSchema,
  updateWorkspaceInputSchema,
  workspaceInputSchema,
} from '@time-stop/domain';
import type { TimeStopApi } from '@time-stop/domain';
import { channels } from '../shared/channels';

export function handle<Input>(
  channel: string,
  schema: ZodType<Input>,
  run: (input: Input) => Promise<unknown>,
): void {
  ipcMain.handle(channel, (_event: IpcMainInvokeEvent, raw: unknown) => run(schema.parse(raw)));
}

/** `onContextChanged` lets the shell re-read what the tray names when the Context moves. */
export function registerIpc(api: TimeStopApi, onContextChanged?: () => void): () => void {
  const none = z.undefined();
  // Only the channels registered here, so teardown leaves other owners' handlers alone.
  const owned: string[] = [];
  const own = <Input>(
    channel: string,
    schema: ZodType<Input>,
    run: (input: Input) => Promise<unknown>,
  ): void => {
    owned.push(channel);
    handle(channel, schema, run);
  };
  own(channels.listWorkspaces, none, () => api.listWorkspaces());
  own(channels.createWorkspace, workspaceInputSchema, (i) => api.createWorkspace(i));
  own(channels.updateWorkspace, updateWorkspaceInputSchema, (i) => api.updateWorkspace(i));
  own(channels.deleteWorkspace, idInputSchema, (i) => api.deleteWorkspace(i));
  own(channels.listClients, listClientsInputSchema.optional(), (i) => api.listClients(i));
  own(channels.createClient, clientInputSchema, (i) => api.createClient(i));
  own(channels.updateClient, updateClientInputSchema, (i) => api.updateClient(i));
  own(channels.deleteClient, idInputSchema, (i) => api.deleteClient(i));
  own(channels.listProjects, listProjectsInputSchema.optional(), (i) => api.listProjects(i));
  own(channels.createProject, projectInputSchema, (i) => api.createProject(i));
  own(channels.updateProject, updateProjectInputSchema, (i) => api.updateProject(i));
  own(channels.archiveProject, idInputSchema, (i) => api.archiveProject(i));
  own(channels.unarchiveProject, idInputSchema, (i) => api.unarchiveProject(i));
  own(channels.deleteProject, idInputSchema, (i) => api.deleteProject(i));
  own(channels.countRecords, countRecordsInputSchema, (i) => api.countRecords(i));
  own(channels.getContext, none, () => api.getContext());
  own(channels.setContext, contextSchema, async (i) => {
    const context = await api.setContext(i);
    onContextChanged?.();
    return context;
  });
  own(channels.startTimer, none, () => api.startTimer());
  own(channels.stopTimer, none, () => api.stopTimer());
  own(channels.getTimer, none, () => api.getTimer());
  own(channels.updateRecordName, updateRecordNameInputSchema, (i) => api.updateRecordName(i));
  own(channels.createRecord, createRecordInputSchema, (i) => api.createRecord(i));
  own(channels.updateRecord, updateRecordInputSchema, (i) => api.updateRecord(i));
  own(channels.deleteRecord, idInputSchema, (i) => api.deleteRecord(i));
  own(channels.listRecentNames, listRecentNamesInputSchema, (i) => api.listRecentNames(i));
  own(channels.listRecords, listRecordsInputSchema, (i) => api.listRecords(i));
  own(channels.setRecordBillable, setRecordBillableInputSchema, (i) => api.setRecordBillable(i));
  own(channels.getDashboard, dashboardInputSchema, (i) => api.getDashboard(i));
  own(channels.exportReport, exportReportInputSchema, (i) => api.exportReport(i));
  own(channels.getServer, none, () => api.getServer());
  own(channels.setServer, serverInputSchema, (i) => api.setServer(i));
  own(channels.getSyncStatus, none, () => api.getSyncStatus());

  const broadcast = (channel: string, payload: unknown): void => {
    for (const contents of webContents.getAllWebContents()) contents.send(channel, payload);
  };
  const unsubscribeTimer = api.subscribeTimer((timer) => broadcast(channels.timerChanged, timer));
  const unsubscribeSync = api.subscribeSync((status) => broadcast(channels.syncChanged, status));

  return () => {
    unsubscribeTimer();
    unsubscribeSync();
    for (const channel of owned) ipcMain.removeHandler(channel);
  };
}
