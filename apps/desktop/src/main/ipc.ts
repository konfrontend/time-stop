import { BrowserWindow, ipcMain, webContents, type IpcMainInvokeEvent } from 'electron';
import { API_PREFIX, api as apiContract } from '@app/domain';
import type { ApiOf, Contract, MethodDescriptor, Api } from '@app/domain';

type WithWindow<Fn> = Fn extends (...args: infer Args) => infer Result
  ? (input: Args extends [] ? undefined : Args[0], window: BrowserWindow | null) => Result
  : never;

/** The methods of a contract, each also handed the window that called it. */
export type Handlers<Groups extends Contract> = {
  [Group in keyof Groups]: {
    [
      Member in keyof Groups[Group] as Groups[Group][Member] extends MethodDescriptor
        ? Member
        : never
    ]: WithWindow<ApiOf<Groups>[Group][Member]>;
  };
};

type Invokable = (input: unknown, window: BrowserWindow | null) => unknown;
type Subscribable = (listener: (value: unknown) => void) => () => void;

export function registerMethods<Groups extends Contract>(
  prefix: string,
  contract: Groups,
  handlers: Handlers<Groups>,
): () => void {
  const implementations = handlers as unknown as {
    [group: string]: { [member: string]: Invokable };
  };
  const channels: string[] = [];
  for (const [group, descriptors] of Object.entries(contract)) {
    for (const [member, descriptor] of Object.entries(descriptors)) {
      if (descriptor.kind !== 'method') continue;
      const channel = `${prefix}:${group}.${member}`;
      const handler = implementations[group]![member]!;
      channels.push(channel);
      ipcMain.handle(channel, (event: IpcMainInvokeEvent, raw: unknown) =>
        handler(descriptor.input?.parse(raw), BrowserWindow.fromWebContents(event.sender)),
      );
    }
  }
  return () => {
    for (const channel of channels) ipcMain.removeHandler(channel);
  };
}

/** Every event reaches every renderer, so a second window follows the Timer too. */
export function broadcastEvents<Groups extends Contract>(
  prefix: string,
  contract: Groups,
  api: ApiOf<Groups>,
): () => void {
  const subscriptions = api as unknown as { [group: string]: { [member: string]: Subscribable } };
  const unsubscribes: Array<() => void> = [];
  for (const [group, descriptors] of Object.entries(contract)) {
    for (const [member, descriptor] of Object.entries(descriptors)) {
      if (descriptor.kind !== 'event') continue;
      const channel = `${prefix}:${group}.${member}`;
      const subscribe = subscriptions[group]![member]!;
      unsubscribes.push(
        subscribe((value) => {
          for (const contents of webContents.getAllWebContents()) contents.send(channel, value);
        }),
      );
    }
  }
  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
}

export function registerIpc(api: Api): () => void {
  const removeMethods = registerMethods(API_PREFIX, apiContract, api);
  const stopEvents = broadcastEvents(API_PREFIX, apiContract, api);
  return () => {
    stopEvents();
    removeMethods();
  };
}
