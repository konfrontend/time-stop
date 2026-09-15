import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';
import { openLocalStore } from '@time-stop/db';
import { registerIpc } from './ipc';
import { registerFilesIpc } from './files';
import { registerImportsIpc } from './imports';
import { registerReleaseIpc } from './release';
import { registerShell } from './shell';
import { registerThemeIpc } from './theme';
import { checkForUpdate } from './updateCheck';
import { createWindow } from './window';

const DATABASE_FILE = 'timestop.sqlite3';

// Tests point the app at a throwaway profile so they never touch the real database.
const profileDir = process.env['TIME_STOP_PROFILE_DIR'];
if (profileDir) app.setPath('userData', profileDir);

void app.whenReady().then(() => {
  const { api, pusher, preferences } = openLocalStore(join(app.getPath('userData'), DATABASE_FILE));
  let window: BrowserWindow | null = null;
  const live = (): BrowserWindow | null => (window && !window.isDestroyed() ? window : null);
  const open = (): BrowserWindow => (window = createWindow(preferences));

  const affordances = registerShell({
    api,
    preferences,
    getWindow: live,
    showWindow: () => {
      const target = live() ?? open();
      target.show();
      target.focus();
    },
  });

  // Once per launch, and only from a packaged build: dev and e2e runs never call GitHub.
  const update = app.isPackaged
    ? checkForUpdate({ currentVersion: app.getVersion() })
    : Promise.resolve(null);

  // Handlers stand before the window so the renderer's first calls always land.
  const removeHandlers = [
    registerIpc(api),
    registerFilesIpc(),
    registerImportsIpc(api),
    registerReleaseIpc(update),
    registerThemeIpc(preferences),
  ];
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
