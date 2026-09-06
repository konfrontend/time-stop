import { ipcMain, webContents, type IpcMainInvokeEvent } from 'electron';
import { z, type ZodType } from 'zod';
import { listRecordsInputSchema, updateRecordNameInputSchema } from '@time-stop/domain';
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
  handle(channels.startTimer, z.undefined(), () => api.startTimer());
  handle(channels.stopTimer, z.undefined(), () => api.stopTimer());
  handle(channels.getTimer, z.undefined(), () => api.getTimer());
  handle(channels.updateRecordName, updateRecordNameInputSchema, (input) =>
    api.updateRecordName(input),
  );
  handle(channels.listRecords, listRecordsInputSchema, (input) => api.listRecords(input));

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
