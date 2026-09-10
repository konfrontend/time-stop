import { contextBridge, ipcRenderer } from 'electron';
import { apiEvents, apiMethods } from '@time-stop/domain';
import type { EventTable, EventValue, MethodTable, TimeStopApi } from '@time-stop/domain';
import { filesMethods, type FilesApi } from '../shared/files';
import { importsMethods, type ImportsApi } from '../shared/imports';
import { shellMethods, type ShellApi } from '../shared/shell';

function bridgeMethods<Api>(
  prefix: string,
  table: MethodTable<Api>,
): Pick<Api, keyof MethodTable<Api>> {
  const bridge: Partial<globalThis.Record<keyof MethodTable<Api>, unknown>> = {};
  for (const method of Object.keys(table) as Array<keyof MethodTable<Api>>) {
    const channel = `${prefix}:${String(method)}`;
    bridge[method] = (input: unknown) => ipcRenderer.invoke(channel, input);
  }
  return bridge as Pick<Api, keyof MethodTable<Api>>;
}

function bridgeEvents<Api>(
  prefix: string,
  table: EventTable<Api>,
): Pick<Api, keyof EventTable<Api>> {
  const bridge: Partial<globalThis.Record<keyof EventTable<Api>, unknown>> = {};
  for (const event of Object.keys(table) as Array<keyof EventTable<Api>>) {
    const channel = `${prefix}:${table[event]}`;
    bridge[event] = (listener: (value: EventValue<Api, typeof event>) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, value: EventValue<Api, typeof event>) =>
        listener(value);
      ipcRenderer.on(channel, handler);
      return () => {
        ipcRenderer.off(channel, handler);
      };
    };
  }
  return bridge as Pick<Api, keyof EventTable<Api>>;
}

const api: TimeStopApi = {
  ...bridgeMethods<TimeStopApi>('timeStop', apiMethods),
  ...bridgeEvents<TimeStopApi>('timeStop', apiEvents),
};
const shell: ShellApi = bridgeMethods<ShellApi>('shell', shellMethods);
const files: FilesApi = bridgeMethods<FilesApi>('files', filesMethods);
const imports: ImportsApi = bridgeMethods<ImportsApi>('imports', importsMethods);

contextBridge.exposeInMainWorld('timeStop', api);
contextBridge.exposeInMainWorld('shell', shell);
contextBridge.exposeInMainWorld('files', files);
contextBridge.exposeInMainWorld('imports', imports);
