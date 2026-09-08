import { app, BrowserWindow } from 'electron';
import { openDatabase } from './database.js';
import { registerIpc } from './ipc.js';
import { registerFilesIpc } from './files.js';
import { readAlwaysOnTop, registerShell } from './shell.js';
import { createWindow } from './window.js';

// Tests point the app at a throwaway profile so they never touch the real database.
const profileDir = process.env['TIME_STOP_PROFILE_DIR'];
if (profileDir) app.setPath('userData', profileDir);

void app.whenReady().then(() => {
  const { api, db } = openDatabase(app.getPath('userData'));
  registerIpc(api);
  registerFilesIpc();

  const open = (): BrowserWindow => createWindow(readAlwaysOnTop(db));
  let window = open();

  registerShell({
    api,
    db,
    getWindow: () => (window.isDestroyed() ? null : window),
    showWindow: () => {
      if (window.isDestroyed()) window = open();
      window.show();
      window.focus();
    },
  });

  // Time Stop records app sessions: a Timer never outlives the app.
  app.on('before-quit', () => {
    void api.stopTimer();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) window = open();
  });
});

// The tray and the hotkey outlive the window: closing it leaves the Timer reachable everywhere.
app.on('window-all-closed', () => {});
