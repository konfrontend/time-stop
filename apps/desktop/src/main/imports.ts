import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { importToggl, parseTogglCsv } from '@time-stop/toggl-import';
import type { TimeStopApi } from '@time-stop/domain';
import { channels } from '../shared/channels';
import { importTogglInputSchema, type ImportTogglResult } from '../shared/imports';

export function registerImportsIpc(api: TimeStopApi): void {
  ipcMain.handle(
    channels.importToggl,
    async (event: IpcMainInvokeEvent, raw: unknown): Promise<ImportTogglResult | null> => {
      const { workspaceId, zone } = importTogglInputSchema.parse(raw);
      const window = BrowserWindow.fromWebContents(event.sender);
      const options = {
        title: 'Choose a Toggl Track CSV export',
        filters: [{ name: 'CSV', extensions: ['csv'] }],
        properties: ['openFile' as const],
      };
      const result = await (window
        ? dialog.showOpenDialog(window, options)
        : dialog.showOpenDialog(options));
      const [path] = result.filePaths;
      if (result.canceled || !path) return null;

      const entries = parseTogglCsv(await readFile(path, 'utf8'), { zone });
      const summary = await importToggl(api, entries, { workspaceId });
      return {
        filename: basename(path),
        projects: summary.projects,
        clients: summary.clients,
        records: summary.records,
        skipped: summary.skipped,
      };
    },
  );
}
