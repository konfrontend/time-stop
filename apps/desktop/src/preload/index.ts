import { contextBridge, ipcRenderer } from 'electron';
import type { Record, TimeStopApi } from '@time-stop/domain';
import { channels } from '../shared/channels.js';

const api: TimeStopApi = {
  listWorkspaces: () => ipcRenderer.invoke(channels.listWorkspaces),
  createWorkspace: (input) => ipcRenderer.invoke(channels.createWorkspace, input),
  updateWorkspace: (input) => ipcRenderer.invoke(channels.updateWorkspace, input),
  deleteWorkspace: (input) => ipcRenderer.invoke(channels.deleteWorkspace, input),
  listClients: (input) => ipcRenderer.invoke(channels.listClients, input),
  createClient: (input) => ipcRenderer.invoke(channels.createClient, input),
  updateClient: (input) => ipcRenderer.invoke(channels.updateClient, input),
  deleteClient: (input) => ipcRenderer.invoke(channels.deleteClient, input),
  listProjects: (input) => ipcRenderer.invoke(channels.listProjects, input),
  createProject: (input) => ipcRenderer.invoke(channels.createProject, input),
  updateProject: (input) => ipcRenderer.invoke(channels.updateProject, input),
  archiveProject: (input) => ipcRenderer.invoke(channels.archiveProject, input),
  unarchiveProject: (input) => ipcRenderer.invoke(channels.unarchiveProject, input),
  deleteProject: (input) => ipcRenderer.invoke(channels.deleteProject, input),
  countRecords: (input) => ipcRenderer.invoke(channels.countRecords, input),
  getContext: () => ipcRenderer.invoke(channels.getContext),
  setContext: (input) => ipcRenderer.invoke(channels.setContext, input),
  startTimer: () => ipcRenderer.invoke(channels.startTimer),
  stopTimer: () => ipcRenderer.invoke(channels.stopTimer),
  getTimer: () => ipcRenderer.invoke(channels.getTimer),
  updateRecordName: (input) => ipcRenderer.invoke(channels.updateRecordName, input),
  listRecords: (input) => ipcRenderer.invoke(channels.listRecords, input),
  setRecordBillable: (input) => ipcRenderer.invoke(channels.setRecordBillable, input),
  getDashboard: (input) => ipcRenderer.invoke(channels.getDashboard, input),
  subscribeTimer: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, timer: Record | null) => listener(timer);
    ipcRenderer.on(channels.timerChanged, handler);
    return () => {
      ipcRenderer.off(channels.timerChanged, handler);
    };
  },
};

contextBridge.exposeInMainWorld('timeStop', api);
