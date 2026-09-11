import { contextBridge, ipcRenderer } from 'electron';
import { TIME_STOP_PREFIX, timeStop } from '@time-stop/domain';
import type { ApiOf, Contract } from '@time-stop/domain';
import { DESKTOP_PREFIX, desktop } from '../shared/desktop';

function bridge<Groups extends Contract>(prefix: string, contract: Groups): ApiOf<Groups> {
  const api: { [group: string]: { [member: string]: unknown } } = {};
  for (const [group, descriptors] of Object.entries(contract)) {
    const members: { [member: string]: unknown } = (api[group] = {});
    for (const [member, descriptor] of Object.entries(descriptors)) {
      const channel = `${prefix}:${group}.${member}`;
      members[member] =
        descriptor.kind === 'method'
          ? (input: unknown) => ipcRenderer.invoke(channel, input)
          : (listener: (value: unknown) => void) => {
              const handler = (_event: Electron.IpcRendererEvent, value: unknown) =>
                listener(value);
              ipcRenderer.on(channel, handler);
              return () => {
                ipcRenderer.off(channel, handler);
              };
            };
    }
  }
  return api as unknown as ApiOf<Groups>;
}

contextBridge.exposeInMainWorld('timeStop', bridge(TIME_STOP_PREFIX, timeStop));
contextBridge.exposeInMainWorld('desktop', bridge(DESKTOP_PREFIX, desktop));
