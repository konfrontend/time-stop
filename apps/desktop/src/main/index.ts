import { app, BrowserWindow } from 'electron';
import { readSetting, writeSetting } from '@time-stop/db';
import { openDatabase } from './database.js';
import { registerIpc } from './ipc.js';
import { registerFilesIpc } from './files.js';
import { registerShell } from './shell.js';
import { createWindow } from './window.js';

const ALWAYS_ON_TOP_KEY = 'windowAlwaysOnTop';

// Tests point the app at a throwaway profile so they never touch the real database.
const profileDir = process.env['TIME_STOP_PROFILE_DIR'];
if (profileDir) app.setPath('userData', profileDir);

void app.whenReady().then(() => {
  const { api, db } = openDatabase(app.getPath('userData'));
  registerIpc(api);
  registerFilesIpc();

  const alwaysOnTop = {
    read: () => readSetting(db, ALWAYS_ON_TOP_KEY) === 'true',
    write: (value: boolean) => writeSetting(db, ALWAYS_ON_TOP_KEY, String(value)),
  };

  const open = (): BrowserWindow => createWindow(alwaysOnTop.read());
  let window = open();

  registerShell({
    api,
    getWindow: () => (window.isDestroyed() ? null : window),
    showWindow: () => {
      if (window.isDestroyed()) window = open();
      window.show();
      window.focus();
    },
    alwaysOnTop,
  });

  // Time Stop records app sessions: a Timer never outlives the app.
  app.on('before-quit', () => {
    void api.stopTimer();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) window = open();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
