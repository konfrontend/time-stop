import { join } from 'node:path';
import { app, BrowserWindow, dialog } from 'electron';
import { DatabaseTooNewError, openLocalStore, type LocalStore } from '@time-stop/db';
import { registerIpc } from './ipc';
import { registerFilesIpc } from './files';
import { registerImportsIpc } from './imports';
import { registerPreferencesIpc } from './preferences';
import { registerReleaseIpc } from './release';
import { registerShell } from './shell';
import { registerThemeIpc } from './theme';
import { checkForUpdate } from './updateCheck';
import { createWindow } from './window';

const DATABASE_FILE = 'timestop.sqlite3';

// Tests point the app at a throwaway profile so they never touch the real database.
const profileDir = process.env['TIME_STOP_PROFILE_DIR'];
if (profileDir) app.setPath('userData', profileDir);
// A dev run keeps its own database, so an unreleased migration never reaches the installed app's.
else if (!app.isPackaged) app.setPath('userData', join(app.getPath('appData'), 'Time Stop Dev'));

// One process per profile: a second would raise a second tray, fight over the global hotkey and
// write the same SQLite file. The lock lives in the user-data directory, so profiles stay separate.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void app.whenReady().then(() => {
    let store: LocalStore;
    try {
      store = openLocalStore(join(app.getPath('userData'), DATABASE_FILE));
    } catch (error) {
      if (!(error instanceof DatabaseTooNewError)) throw error;
      dialog.showErrorBox(
        'Time Stop is out of date',
        'This database was written by a newer version of Time Stop. Install that version again to open it — your Records are untouched.',
      );
      app.exit(1);
      return;
    }

    const { api, pusher, preferences } = store;
    let window: BrowserWindow | null = null;
    const live = (): BrowserWindow | null => (window && !window.isDestroyed() ? window : null);
    const open = (): BrowserWindow => (window = createWindow(preferences));
    const showWindow = (): void => {
      const target = live() ?? open();
      target.show();
      target.focus();
    };

    const affordances = registerShell({ api, preferences, getWindow: live, showWindow });

    // Once per launch, and only from a packaged build: dev and e2e runs never call GitHub.
    const update = app.isPackaged
      ? checkForUpdate({ currentVersion: app.getVersion() })
      : Promise.resolve(null);

    // Handlers stand before the window so the renderer's first calls always land.
    const removeHandlers = [
      registerIpc(api),
      registerFilesIpc(),
      registerImportsIpc(api),
      registerPreferencesIpc(preferences),
      registerReleaseIpc(update),
      registerThemeIpc(preferences),
    ];

    // Time Stop records app sessions: a Timer never outlives the app.
    let ended = false;
    const endSession = (): void => {
      if (ended) return;
      ended = true;
      // The stop is written before this returns, which is all a logoff waits for, and it goes out
      // while the shell and the renderer can still hear it.
      void api.record.stopTimer();
      affordances.dispose();
      for (const remove of removeHandlers) remove();
      pusher.stop();
    };

    app.on('before-quit', endSession);
    // A Windows logoff or shutdown takes the process without quitting it, and only a window hears
    // it. With none open the store stops the abandoned Timer on the next launch instead.
    app.on('browser-window-created', (_event, window) => window.on('session-end', endSession));

    open();

    // Whatever the last session left unsent goes out now.
    pusher.kick();

    app.on('second-instance', showWindow);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) open();
    });
  });
}

// The tray and the hotkey outlive the window: closing it leaves the Timer reachable everywhere.
app.on('window-all-closed', () => {});
