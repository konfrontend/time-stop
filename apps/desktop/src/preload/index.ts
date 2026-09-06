import { contextBridge, ipcRenderer } from 'electron';
import type { Record, TimeStopApi } from '@time-stop/domain';

// Mirrors `channels` in ../main/ipc.ts; kept literal so the preload bundle stays Electron-only.
const api: TimeStopApi = {
  startTimer: () => ipcRenderer.invoke('timeStop:startTimer'),
  stopTimer: () => ipcRenderer.invoke('timeStop:stopTimer'),
  getTimer: () => ipcRenderer.invoke('timeStop:getTimer'),
  updateRecordName: (input) => ipcRenderer.invoke('timeStop:updateRecordName', input),
  listRecords: (input) => ipcRenderer.invoke('timeStop:listRecords', input),
  subscribeTimer: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, timer: Record | null) => listener(timer);
    ipcRenderer.on('timeStop:timerChanged', handler);
    return () => {
      ipcRenderer.off('timeStop:timerChanged', handler);
    };
  },
};

contextBridge.exposeInMainWorld('timeStop', api);
