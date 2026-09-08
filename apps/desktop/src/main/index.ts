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
  let window: BrowserWindow | null = null;
  const live = (): BrowserWindow | null => (window && !window.isDestroyed() ? window : null);
  const open = (): BrowserWindow => (window = createWindow(readAlwaysOnTop(db)));

  const shell = registerShell({
    api,
    db,
    getWindow: live,
    showWindow: () => {
      const target = live() ?? open();
      target.show();
      target.focus();
    },
  });

  // Handlers stand before the window so the renderer's first calls always land.
  registerIpc(api, shell.refresh);
  registerFilesIpc();
  open();

  // Time Stop records app sessions: a Timer never outlives the app.
  app.on('before-quit', () => {
    void api.stopTimer();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) open();
  });
});

// The tray and the hotkey outlive the window: closing it leaves the Timer reachable everywhere.
app.on('window-all-closed', () => {});
