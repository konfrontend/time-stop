import { BrowserWindow, ipcMain, webContents, type IpcMainInvokeEvent } from 'electron';
import { apiEvents, apiMethods } from '@time-stop/domain';
import type { EventTable, MethodInput, MethodTable, TimeStopApi } from '@time-stop/domain';

export type Handlers<Api> = {
  [M in keyof MethodTable<Api>]: (
    input: MethodInput<Api, M>,
    window: BrowserWindow | null,
  ) => Api[M] extends (...args: never[]) => infer Result ? Result : never;
};

export function registerMethods<Api>(
  prefix: string,
  table: MethodTable<Api>,
  handlers: Handlers<Api>,
): () => void {
  const channels: string[] = [];
  for (const method of Object.keys(table) as Array<keyof MethodTable<Api>>) {
    const channel = `${prefix}:${String(method)}`;
    const schema = table[method];
    channels.push(channel);
    ipcMain.handle(channel, (event: IpcMainInvokeEvent, raw: unknown) =>
      handlers[method](
        (schema ? schema.parse(raw) : undefined) as MethodInput<Api, typeof method>,
        BrowserWindow.fromWebContents(event.sender),
      ),
    );
  }
  return () => {
    for (const channel of channels) ipcMain.removeHandler(channel);
  };
}

/** Every event reaches every renderer, so a second window follows the Timer too. */
export function broadcastEvents<Api>(
  prefix: string,
  table: EventTable<Api>,
  api: { [M in keyof EventTable<Api>]: (listener: (value: never) => void) => () => void },
): () => void {
  const unsubscribes = (Object.keys(table) as Array<keyof EventTable<Api>>).map((event) => {
    const channel = `${prefix}:${table[event]}`;
    return api[event]((value: unknown) => {
      for (const contents of webContents.getAllWebContents()) contents.send(channel, value);
    });
  });
  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
}

export function registerIpc(api: TimeStopApi): () => void {
  const removeMethods = registerMethods('timeStop', apiMethods, api);
  const stopEvents = broadcastEvents('timeStop', apiEvents, api);
  return () => {
    stopEvents();
    removeMethods();
  };
}
