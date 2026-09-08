import { writeFile } from 'node:fs/promises';
import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { channels } from '../shared/channels';
import { saveTextInputSchema } from '../shared/files';

export function registerFilesIpc(): void {
  ipcMain.handle(channels.saveText, async (event: IpcMainInvokeEvent, raw: unknown) => {
    const { filename, text } = saveTextInputSchema.parse(raw);
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = { defaultPath: filename };
    const result = await (window
      ? dialog.showSaveDialog(window, options)
      : dialog.showSaveDialog(options));
    if (result.canceled || !result.filePath) return false;
    await writeFile(result.filePath, text, 'utf8');
    return true;
  });
}
