import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { dialog } from 'electron';
import { parseTogglCsv } from './togglCsv';
import { importToggl } from './importToggl';
import type { Api } from '@app/domain';
import { DESKTOP_PREFIX } from '../../shared/desktop';
import { imports, type ImportTogglResult } from '../../shared/imports';
import { registerMethods } from '../ipc';

export function registerImportsIpc(api: Api): () => void {
  return registerMethods(
    DESKTOP_PREFIX,
    { imports },
    {
      imports: {
        async importToggl({ workspaceId, zone }, window): Promise<ImportTogglResult | null> {
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
      },
    },
  );
}
