import { writeFile } from 'node:fs/promises';
import { dialog } from 'electron';
import { DESKTOP_PREFIX } from '../shared/desktop';
import { files } from '../shared/files';
import { registerMethods } from './ipc';

export function registerFilesIpc(): () => void {
  return registerMethods(
    DESKTOP_PREFIX,
    { files },
    {
      files: {
        async saveText({ filename, text }, window) {
          const options = { defaultPath: filename };
          const result = await (window
            ? dialog.showSaveDialog(window, options)
            : dialog.showSaveDialog(options));
          if (result.canceled || !result.filePath) return false;
          await writeFile(result.filePath, text, 'utf8');
          return true;
        },
      },
    },
  );
}
