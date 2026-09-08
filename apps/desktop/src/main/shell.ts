import { fileURLToPath } from 'node:url';
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Tray,
  type IpcMainInvokeEvent,
} from 'electron';
import { z } from 'zod';
import type { Project, Record, TimeStopApi } from '@time-stop/domain';
import { channels } from '../shared/channels.js';
import { windowModeSchema } from '../shared/shell.js';
import { trayLine, windowTitle } from './shellText.js';
import { applyWindowMode } from './window.js';

/** Start and stop from any app, whatever has focus. */
export const TOGGLE_TIMER_SHORTCUT = 'CommandOrControl+Alt+T';

const TICK_MS = 1000;

export interface ShellOptions {
  api: TimeStopApi;
  getWindow: () => BrowserWindow | null;
  showWindow: () => void;
  alwaysOnTop: {
    read(): boolean;
    write(value: boolean): void;
  };
}

/**
 * The shell affordances that reach past the window: tray, global hotkey, Dock badge and window
 * title, all fed by the Timer the main process already watches. Returns a teardown.
 */
export function registerShell(options: ShellOptions): () => void {
  const { api, getWindow, showWindow, alwaysOnTop } = options;

  let timer: Record | null = null;
  let projects: Project[] = [];
  let tick: ReturnType<typeof setInterval> | undefined;

  const tray = new Tray(
    nativeImage.createFromPath(
      fileURLToPath(new URL('../../resources/trayTemplate.png', import.meta.url)),
    ),
  );
  tray.setIgnoreDoubleClickEvents(true);

  function projectName(): string | null {
    if (!timer?.projectId) return null;
    return projects.find((project) => project.id === timer?.projectId)?.name ?? null;
  }

  function render(): void {
    const now = Date.now();
    const line = trayLine({ timer, projectName: projectName(), now });
    if (process.platform === 'darwin') tray.setTitle(timer ? line : '');
    tray.setToolTip(line);
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: line, enabled: false },
        { type: 'separator' },
        timer
          ? { label: 'Stop', click: () => void api.stopTimer() }
          : { label: 'Start', click: () => void api.startTimer() },
        { label: 'Open Time Stop', click: showWindow },
        { type: 'separator' },
        { label: 'Quit Time Stop', click: () => app.quit() },
      ]),
    );
    getWindow()?.setTitle(windowTitle(timer, now));
    app.dock?.setBadge(timer ? '●' : '');
  }

  function onTimer(next: Record | null): void {
    timer = next;
    if (next && !tick) tick = setInterval(render, TICK_MS);
    if (!next && tick) {
      clearInterval(tick);
      tick = undefined;
    }
    render();
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

  globalShortcut.register(TOGGLE_TIMER_SHORTCUT, () => {
    void (timer ? api.stopTimer() : api.startTimer());
  });

  ipcMain.handle(channels.isAlwaysOnTop, () => alwaysOnTop.read());
  ipcMain.handle(channels.setAlwaysOnTop, (_event: IpcMainInvokeEvent, raw: unknown) => {
    const value = z.boolean().parse(raw);
    alwaysOnTop.write(value);
    for (const window of BrowserWindow.getAllWindows()) window.setAlwaysOnTop(value);
    return value;
  });
  ipcMain.handle(channels.setWindowMode, (event: IpcMainInvokeEvent, raw: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) applyWindowMode(window, windowModeSchema.parse(raw));
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
