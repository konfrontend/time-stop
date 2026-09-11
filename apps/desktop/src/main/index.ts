import { app, BrowserWindow } from 'electron';
import { openDatabase } from './database';
import { registerIpc } from './ipc';
import { registerFilesIpc } from './files';
import { registerImportsIpc } from './imports';
import { readAlwaysOnTop, registerShell } from './shell';
import { createWindow } from './window';

// Tests point the app at a throwaway profile so they never touch the real database.
const profileDir = process.env['TIME_STOP_PROFILE_DIR'];
if (profileDir) app.setPath('userData', profileDir);

void app.whenReady().then(() => {
  const { api, db, pusher } = openDatabase(app.getPath('userData'));
  let window: BrowserWindow | null = null;
  const live = (): BrowserWindow | null => (window && !window.isDestroyed() ? window : null);
  const open = (): BrowserWindow => (window = createWindow(readAlwaysOnTop(db)));

  const affordances = registerShell({
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
  const removeHandlers = [registerIpc(api), registerFilesIpc(), registerImportsIpc(api)];
  open();

  // Whatever the last session left unsent goes out now.
  pusher.kick();

  // Time Stop records app sessions: a Timer never outlives the app.
  app.on('before-quit', () => {
    affordances.dispose();
    for (const remove of removeHandlers) remove();
    pusher.stop();
    void api.record.stopTimer();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) open();
  });
});

// The tray and the hotkey outlive the window: closing it leaves the Timer reachable everywhere.
app.on('window-all-closed', () => {});
