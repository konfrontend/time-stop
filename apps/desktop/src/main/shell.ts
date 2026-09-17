import { fileURLToPath } from 'node:url';
import {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  nativeImage,
  nativeTheme,
  Tray,
  type MenuItemConstructorOptions,
} from 'electron';
import type { Preferences } from '@time-stop/db';
import type { Context, Project, Record, TimeStopApi, Workspace } from '@time-stop/domain';
import { DESKTOP_PREFIX } from '../shared/desktop';
import { shell } from '../shared/shell';
import { registerMethods } from './ipc';
import { APP_NAME, trayLine, windowTitle } from './shellText';
import { DEFAULT_TASKBAR_IS_DARK, readTaskbarIsDark } from './taskbarTheme';
import { trayIconName } from './trayIcon';

/** Start and stop from any app, whatever has focus. */
export const TOGGLE_TIMER_SHORTCUT = 'CommandOrControl+Alt+S';

/** Start and stop while Time Stop has focus; shown as the hint beside every Start/Pause item. */
export const TOGGLE_TIMER_ACCELERATOR = 'CommandOrControl+S';

export const TOGGLE_TIMER_MENU_ID = 'timer:startStop';

/** A Tray has no text getter, and an overlay icon none at all, so headless e2e runs read both here. */
export interface ShellProbe {
  trayLine: string;
  trayIcon: string;
  taskbarOverlay: boolean;
  clickTray: () => void;
}

declare global {
  var timeStopShell: ShellProbe | undefined;
}

const probe: ShellProbe | null = process.env['TIME_STOP_HEADLESS']
  ? (globalThis.timeStopShell = {
      trayLine: '',
      trayIcon: '',
      taskbarOverlay: false,
      clickTray: () => {},
    })
  : null;

const TICK_MS = 1000;
const TASKBAR_THEME_POLL_MS = 60_000;
const DOCK_BADGE = '●';

const TASKBAR_OVERLAY = 'taskbarRunning.png';
const TASKBAR_OVERLAY_DESCRIPTION = 'Timer running';

const image = (name: string) =>
  nativeImage.createFromPath(fileURLToPath(new URL(`../../resources/${name}`, import.meta.url)));

export interface ShellOptions {
  api: TimeStopApi;
  preferences: Preferences;
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
export function registerShell({ api, preferences, getWindow, showWindow }: ShellOptions): Shell {
  let timer: Record | null = null;
  let projects: Project[] = [];
  let workspaces: Workspace[] = [];
  let context: Context | null = null;
  let tick: ReturnType<typeof setInterval> | undefined;
  let taskbarIsDark = DEFAULT_TASKBAR_IS_DARK;
  let overlaidWindow: BrowserWindow | null = null;
  let overlaidRunning = false;

  // A desktop with no status-icon host refuses a Tray; the menus and the hotkey still stand.
  let tray: Tray | null = null;
  try {
    tray = new Tray(image(trayIconName('standby', { platform: process.platform, taskbarIsDark })));
    if (process.platform === 'darwin') tray.setIgnoreDoubleClickEvents(true);
    // Windows opens an app from a left-click on its status icon; macOS drops the menu instead.
    if (process.platform === 'win32') tray.on('click', showWindow);
    if (probe) probe.clickTray = () => tray?.emit('click');
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
    applyOverlay();
  }

  /**
   * Windows' answer to the Dock badge: a dot on the taskbar button while a Timer runs. It belongs
   * to the window, so a window opened after the Timer started takes it on the next tick.
   */
  function applyOverlay(): void {
    if (process.platform !== 'win32') return;
    const window = getWindow();
    const running = timer !== null;
    if (!window || (window === overlaidWindow && running === overlaidRunning)) return;
    window.setOverlayIcon(
      running ? image(TASKBAR_OVERLAY) : null,
      running ? TASKBAR_OVERLAY_DESCRIPTION : '',
    );
    overlaidWindow = window;
    overlaidRunning = running;
    if (probe) probe.taskbarOverlay = running;
  }

  /** The tray glyph and the badges: what the Timer and the taskbar's own theme decide between. */
  function renderIcons(): void {
    const icon = trayIconName(timer ? 'recording' : 'standby', {
      platform: process.platform,
      taskbarIsDark,
    });
    if (probe) probe.trayIcon = icon;
    tray?.setImage(image(icon));
    app.dock?.setBadge(timer ? DOCK_BADGE : '');
    applyOverlay();
  }

  /**
   * The taskbar theme is the Owner's, not the app's: it changes under a running app, and Electron
   * reports only the theme the app itself draws with.
   */
  function refreshTaskbarTheme(): void {
    void readTaskbarIsDark().then((dark) => {
      if (dark === taskbarIsDark) return;
      taskbarIsDark = dark;
      renderIcons();
    });
  }

  function startStopItem(): MenuItemConstructorOptions {
    return {
      id: TOGGLE_TIMER_MENU_ID,
      label: timer ? 'Pause' : 'Start',
      accelerator: TOGGLE_TIMER_ACCELERATOR,
      click: () => void toggleTimer(),
    };
  }

  /**
   * The tray image, the menus and the badge. Kept off the tick: replacing a menu while it is
   * open under the pointer closes it.
   */
  function renderMenu(): void {
    renderIcons();
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
  }

  /**
   * The tray line names a Project or a Workspace, so both lists are re-read on every Timer and
   * Context change. The reads are async: the last to land wins, a failed one changes nothing.
   */
  function refreshNames(): void {
    void Promise.all([api.project.list(), api.workspace.list()]).then(
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

  const unsubscribeTimer = api.record.onTimerChanged(onTimer);
  const unsubscribeContext = api.context.onContextChanged(onContext);
  void api.record.getTimer().then(onTimer);
  void api.context.get().then(onContext);

  renderMenu();

  let stopTaskbarThemeWatch = (): void => {};
  if (process.platform === 'win32') {
    refreshTaskbarTheme();
    const onThemeUpdated = (): void => refreshTaskbarTheme();
    nativeTheme.on('updated', onThemeUpdated);
    // The event carries only the appearance the app draws with: an Owner who pinned Time Stop to
    // light or dark never gets one for a taskbar they switch, so the reading is retaken anyway.
    const poll = setInterval(refreshTaskbarTheme, TASKBAR_THEME_POLL_MS);
    stopTaskbarThemeWatch = () => {
      nativeTheme.off('updated', onThemeUpdated);
      clearInterval(poll);
    };
  }

  // A taken accelerator leaves the rest of the shell working; the window still starts Timers.
  if (!globalShortcut.register(TOGGLE_TIMER_SHORTCUT, () => void toggleTimer())) {
    console.warn(`Another app holds ${TOGGLE_TIMER_SHORTCUT}; the Timer hotkey is off.`);
  }

  function toggleTimer(): Promise<Record | null> {
    return timer ? api.record.stopTimer() : api.record.startTimer();
  }

  const removeMethods = registerMethods(
    DESKTOP_PREFIX,
    { shell },
    {
      shell: {
        async isAlwaysOnTop() {
          return preferences.isAlwaysOnTop();
        },
        async setAlwaysOnTop(value) {
          preferences.setAlwaysOnTop(value);
          for (const window of BrowserWindow.getAllWindows()) window.setAlwaysOnTop(value);
          return value;
        },
      },
    },
  );

  return {
    dispose: () => {
      unsubscribeTimer();
      unsubscribeContext();
      clearInterval(tick);
      stopTaskbarThemeWatch();
      globalShortcut.unregister(TOGGLE_TIMER_SHORTCUT);
      tray?.destroy();
      removeMethods();
    },
  };
}
