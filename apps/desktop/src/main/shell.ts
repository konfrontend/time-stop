import { fileURLToPath } from 'node:url';
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Tray,
  type MenuItemConstructorOptions,
} from 'electron';
import { z } from 'zod';
import { readSetting, writeSetting } from '@time-stop/db';
import type { SqliteDb } from '@time-stop/db';
import type { Context, Project, Record, TimeStopApi, Workspace } from '@time-stop/domain';
import { channels } from '../shared/channels.js';
import { windowModeSchema } from '../shared/shell.js';
import { handle } from './ipc.js';
import { APP_NAME, trayLine, windowTitle } from './shellText.js';
import { applyWindowMode } from './window.js';

/** Start and stop from any app, whatever has focus. */
export const TOGGLE_TIMER_SHORTCUT = 'CommandOrControl+Alt+T';

/** Start and stop while Time Stop has focus; shown as the hint beside every Start/Stop item. */
export const TOGGLE_TIMER_ACCELERATOR = 'CommandOrControl+S';

export const TOGGLE_TIMER_MENU_ID = 'timer:startStop';

const ALWAYS_ON_TOP_KEY = 'windowAlwaysOnTop';
const TICK_MS = 1000;
const DOCK_BADGE = '●';

// The tray icon carries the status: an open ring on standby, a filled dot while a Timer runs.
const trayIcon = (state: 'standby' | 'recording') =>
  nativeImage.createFromPath(
    fileURLToPath(
      new URL(
        `../../resources/tray${state === 'recording' ? 'Recording' : 'Standby'}Template.png`,
        import.meta.url,
      ),
    ),
  );

export function readAlwaysOnTop(db: SqliteDb): boolean {
  return readSetting(db, ALWAYS_ON_TOP_KEY) === 'true';
}

export interface ShellOptions {
  api: TimeStopApi;
  db: SqliteDb;
  getWindow: () => BrowserWindow | null;
  showWindow: () => void;
}

export interface Shell {
  // Call when the Context moves: the tray names its Project or Workspace on standby.
  refresh: () => void;
  dispose: () => void;
}

/**
 * The shell affordances that reach past the window: tray, global hotkey, Dock badge and window
 * title, all fed by the Timer the main process already watches.
 */
export function registerShell({ api, db, getWindow, showWindow }: ShellOptions): Shell {
  let timer: Record | null = null;
  let projects: Project[] = [];
  let workspaces: Workspace[] = [];
  let context: Context | null = null;
  let tick: ReturnType<typeof setInterval> | undefined;

  const tray = new Tray(trayIcon('standby'));
  tray.setIgnoreDoubleClickEvents(true);

  // The Timer names itself; without one the Context stands in for it.
  function line(): string {
    const projectId = timer ? timer.projectId : context?.projectId;
    const workspaceId = timer ? timer.workspaceId : context?.workspaceId;
    return trayLine({
      timer,
      recordName: timer?.name ?? '',
      projectName: projects.find(({ id }) => id === projectId)?.name ?? null,
      workspaceName: workspaces.find(({ id }) => id === workspaceId)?.name ?? APP_NAME,
      now: Date.now(),
    });
  }

  // Every second, so the tray and the title count along with the Timer.
  function tickShell(): void {
    // Only macOS puts text next to the tray icon; elsewhere the tooltip and menu carry the line.
    if (process.platform === 'darwin') tray.setTitle(line());
    getWindow()?.setTitle(windowTitle(timer, Date.now()));
  }

  function startStopItem(): MenuItemConstructorOptions {
    return {
      id: TOGGLE_TIMER_MENU_ID,
      label: timer ? 'Stop' : 'Start',
      accelerator: TOGGLE_TIMER_ACCELERATOR,
      click: () => void toggleTimer(),
    };
  }

  // Only on start and stop: replacing the menu under an open one would close it.
  function renderMenu(): void {
    tray.setImage(trayIcon(timer ? 'recording' : 'standby'));
    tray.setToolTip(line());
    tray.setContextMenu(
      Menu.buildFromTemplate([
        // The tray shows the shortcut as a hint; the app menu is what binds it.
        { ...startStopItem(), registerAccelerator: false },
        { label: 'Open Time Stop', click: showWindow },
        { type: 'separator' },
        { label: 'Quit Time Stop', click: () => app.quit() },
      ]),
    );
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        ...(process.platform === 'darwin'
          ? ([{ role: 'appMenu' }] satisfies MenuItemConstructorOptions[])
          : []),
        { label: 'Timer', submenu: [startStopItem()] },
        { role: 'editMenu' },
        { role: 'windowMenu' },
      ]),
    );
    app.dock?.setBadge(timer ? DOCK_BADGE : '');
  }

  function onTimer(next: Record | null): void {
    const wasRunning = timer !== null;
    const named = timer?.name !== next?.name;
    timer = next;
    if (next && !tick) tick = setInterval(tickShell, TICK_MS);
    if (!next && tick) {
      clearInterval(tick);
      tick = undefined;
    }
    if (wasRunning !== (next !== null) || named) renderMenu();
    tickShell();
  }

  // The tray line names a Project or a Workspace, so both lists follow the Timer and the Context.
  function refresh(next: Record | null): void {
    void Promise.all([api.listProjects(), api.listWorkspaces(), api.getContext()]).then(
      ([projectList, workspaceList, current]) => {
        projects = projectList;
        workspaces = workspaceList;
        context = current;
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

  return {
    refresh: () => refresh(timer),
    dispose: () => {
      unsubscribe();
      clearInterval(tick);
      globalShortcut.unregister(TOGGLE_TIMER_SHORTCUT);
      tray.destroy();
      for (const channel of [
        channels.isAlwaysOnTop,
        channels.setAlwaysOnTop,
        channels.setWindowMode,
      ])
        ipcMain.removeHandler(channel);
    },
  };
}
