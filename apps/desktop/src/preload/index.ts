import { contextBridge, ipcRenderer } from 'electron';
import type { Record, TimeStopApi } from '@time-stop/domain';
import { channels } from '../shared/channels.js';

const api: TimeStopApi = {
  startTimer: () => ipcRenderer.invoke(channels.startTimer),
  stopTimer: () => ipcRenderer.invoke(channels.stopTimer),
  getTimer: () => ipcRenderer.invoke(channels.getTimer),
  updateRecordName: (input) => ipcRenderer.invoke(channels.updateRecordName, input),
  listRecords: (input) => ipcRenderer.invoke(channels.listRecords, input),
  subscribeTimer: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, timer: Record | null) => listener(timer);
    ipcRenderer.on(channels.timerChanged, handler);
    return () => {
      ipcRenderer.off(channels.timerChanged, handler);
    };
  },
};

contextBridge.exposeInMainWorld('timeStop', api);
