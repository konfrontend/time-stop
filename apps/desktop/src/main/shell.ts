import { fileURLToPath } from 'node:url';
import {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  nativeImage,
  Tray,
  type MenuItemConstructorOptions,
} from 'electron';
import { readSetting, writeSetting } from '@time-stop/db';
import type { SqliteDb } from '@time-stop/db';
import type { Context, Project, Record, TimeStopApi, Workspace } from '@time-stop/domain';
import { shellMethods } from '../shared/shell';
import { registerMethods } from './ipc';
import { APP_NAME, trayLine, windowTitle } from './shellText';
import { applyWindowMode } from './window';

/** Start and stop from any app, whatever has focus. */
export const TOGGLE_TIMER_SHORTCUT = 'CommandOrControl+Alt+S';

/** Start and stop while Time Stop has focus; shown as the hint beside every Start/Stop item. */
export const TOGGLE_TIMER_ACCELERATOR = 'CommandOrControl+S';

export const TOGGLE_TIMER_MENU_ID = 'timer:startStop';

/** A Tray has no text getter off macOS, so headless e2e runs read the line from here. */
export interface ShellProbe {
  trayLine: string;
}
const probe = process.env['TIME_STOP_HEADLESS']
  ? ((globalThis as typeof globalThis & { timeStopShell?: ShellProbe }).timeStopShell = {
      trayLine: '',
    })
  : null;

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
  dispose: () => void;
}

/**
 * The shell affordances that reach past the window: tray, global hotkey, Dock badge and window
 * title, all fed by the Timer and the Context the api reports.
 */
export function registerShell({ api, db, getWindow, showWindow }: ShellOptions): Shell {
  let timer: Record | null = null;
  let projects: Project[] = [];
  let workspaces: Workspace[] = [];
  let context: Context | null = null;
  let tick: ReturnType<typeof setInterval> | undefined;

  // A desktop with no status-icon host refuses a Tray; the menus and the hotkey still stand.
  let tray: Tray | null = null;
  try {
    tray = new Tray(trayIcon('standby'));
    if (process.platform === 'darwin') tray.setIgnoreDoubleClickEvents(true);
  } catch (error) {
    console.warn('No system tray available; Time Stop runs without one.', error);
  }

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

  /**
   * The parts of the shell that count along with the Timer: every second while one runs, and
   * once more whenever the Timer or the Context changes what the line says.
   */
  function tickShell(): void {
    const text = line();
    if (probe) probe.trayLine = text;
    // Only macOS puts text next to the tray icon; elsewhere the tooltip carries the line alone.
    if (process.platform === 'darwin') tray?.setTitle(text);
    tray?.setToolTip(text);
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

  /**
   * The tray image, the menus and the badge. Kept off the tick: replacing a menu while it is
   * open under the pointer closes it.
   */
  function renderMenu(): void {
    tray?.setImage(trayIcon(timer ? 'recording' : 'standby'));
    tray?.setContextMenu(
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

  /**
   * The tray line names a Project or a Workspace, so both lists are re-read on every Timer and
   * Context change. The reads are async: the last to land wins, a failed one changes nothing.
   */
  function refreshNames(): void {
    void Promise.all([api.listProjects(), api.listWorkspaces()]).then(
      ([projectList, workspaceList]) => {
        projects = projectList;
        workspaces = workspaceList;
        tickShell();
      },
      () => {},
    );
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
    refreshNames();
  }

  function onContext(next: Context): void {
    context = next;
    tickShell();
    refreshNames();
  }

  const unsubscribeTimer = api.subscribeTimer(onTimer);
  const unsubscribeContext = api.subscribeContext(onContext);
  void api.getTimer().then(onTimer);
  void api.getContext().then(onContext);

  renderMenu();

  // A taken accelerator leaves the rest of the shell working; the window still starts Timers.
  if (!globalShortcut.register(TOGGLE_TIMER_SHORTCUT, () => void toggleTimer())) {
    console.warn(`Another app holds ${TOGGLE_TIMER_SHORTCUT}; the Timer hotkey is off.`);
  }

  function toggleTimer(): Promise<Record | null> {
    return timer ? api.stopTimer() : api.startTimer();
  }

  const removeMethods = registerMethods('shell', shellMethods, {
    async isAlwaysOnTop() {
      return readAlwaysOnTop(db);
    },
    async setAlwaysOnTop(value) {
      writeSetting(db, ALWAYS_ON_TOP_KEY, String(value));
      for (const window of BrowserWindow.getAllWindows()) window.setAlwaysOnTop(value);
      return value;
    },
    async setWindowMode(mode, window) {
      if (window) applyWindowMode(window, mode);
    },
  });

  return {
    dispose: () => {
      unsubscribeTimer();
      unsubscribeContext();
      clearInterval(tick);
      globalShortcut.unregister(TOGGLE_TIMER_SHORTCUT);
      tray?.destroy();
      removeMethods();
    },
  };
}
