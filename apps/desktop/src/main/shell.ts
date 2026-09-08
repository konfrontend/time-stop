import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, Tray } from 'electron';
import { z } from 'zod';
import { readSetting, writeSetting } from '@time-stop/db';
import type { SqliteDb } from '@time-stop/db';
import type { Project, Record, TimeStopApi } from '@time-stop/domain';
import { channels } from '../shared/channels.js';
import { windowModeSchema } from '../shared/shell.js';
import { handle } from './ipc.js';
import { RECORDING_DOT, trayLine, windowTitle } from './shellText.js';
import { applyWindowMode } from './window.js';

/** Start and stop from any app, whatever has focus. */
export const TOGGLE_TIMER_SHORTCUT = 'CommandOrControl+Alt+T';

const ALWAYS_ON_TOP_KEY = 'windowAlwaysOnTop';
const TICK_MS = 1000;

export function readAlwaysOnTop(db: SqliteDb): boolean {
  return readSetting(db, ALWAYS_ON_TOP_KEY) === 'true';
}

export interface ShellOptions {
  api: TimeStopApi;
  db: SqliteDb;
  getWindow: () => BrowserWindow | null;
  showWindow: () => void;
}

/**
 * The shell affordances that reach past the window: tray, global hotkey, Dock badge and window
 * title, all fed by the Timer the main process already watches. Returns a teardown.
 */
export function registerShell({ api, db, getWindow, showWindow }: ShellOptions): () => void {
  let timer: Record | null = null;
  let projects: Project[] = [];
  let tick: ReturnType<typeof setInterval> | undefined;

  const tray = new Tray(
    nativeImage.createFromPath(
      fileURLToPath(new URL('../../resources/trayTemplate.png', import.meta.url)),
    ),
  );
  tray.setIgnoreDoubleClickEvents(true);

  function line(): string {
    const project = timer?.projectId
      ? (projects.find(({ id }) => id === timer?.projectId)?.name ?? null)
      : null;
    return trayLine({ timer, projectName: project, now: Date.now() });
  }

  // Every second, so the tray and the title count along with the Timer.
  function tickShell(): void {
    // Only macOS puts text next to the tray icon; elsewhere the tooltip and menu carry the line.
    if (process.platform === 'darwin') tray.setTitle(line());
    getWindow()?.setTitle(windowTitle(timer, Date.now()));
  }

  // Only on start and stop: replacing the menu under an open one would close it.
  function renderMenu(): void {
    tray.setToolTip(line());
    tray.setContextMenu(
      Menu.buildFromTemplate([
        timer
          ? { label: 'Stop', click: () => void api.stopTimer() }
          : { label: 'Start', click: () => void api.startTimer() },
        { label: 'Open Time Stop', click: showWindow },
        { type: 'separator' },
        { label: 'Quit Time Stop', click: () => app.quit() },
      ]),
    );
    app.dock?.setBadge(timer ? RECORDING_DOT : '');
  }

  function onTimer(next: Record | null): void {
    const wasRunning = timer !== null;
    timer = next;
    if (next && !tick) tick = setInterval(tickShell, TICK_MS);
    if (!next && tick) {
      clearInterval(tick);
      tick = undefined;
    }
    if (wasRunning !== (next !== null)) renderMenu();
    tickShell();
  }

  // The tray line names the Timer's Project, so the Project list is refreshed alongside it.
  function refresh(next: Record | null): void {
    void api.listProjects().then(
      (list) => {
        projects = list;
        onTimer(next);
      },
      () => onTimer(next),
    );
  }

  const unsubscribe = api.subscribeTimer(refresh);
  void api.getTimer().then(refresh);

  renderMenu();

  // A taken accelerator leaves the rest of the shell working; the window still starts Timers.
  if (!globalShortcut.register(TOGGLE_TIMER_SHORTCUT, () => void toggleTimer())) {
    console.warn(`Another app holds ${TOGGLE_TIMER_SHORTCUT}; the Timer hotkey is off.`);
  }

  function toggleTimer(): Promise<Record | null> {
    return timer ? api.stopTimer() : api.startTimer();
  }

  handle(channels.isAlwaysOnTop, z.undefined(), async () => readAlwaysOnTop(db));
  handle(channels.setAlwaysOnTop, z.boolean(), async (value) => {
    writeSetting(db, ALWAYS_ON_TOP_KEY, String(value));
    for (const window of BrowserWindow.getAllWindows()) window.setAlwaysOnTop(value);
    return value;
  });
  handle(channels.setWindowMode, windowModeSchema, async (mode) => {
    const window = getWindow();
    if (window) applyWindowMode(window, mode);
  });

  return () => {
    unsubscribe();
    clearInterval(tick);
    globalShortcut.unregister(TOGGLE_TIMER_SHORTCUT);
    tray.destroy();
    for (const channel of [channels.isAlwaysOnTop, channels.setAlwaysOnTop, channels.setWindowMode])
      ipcMain.removeHandler(channel);
  };
}
