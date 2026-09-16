import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, type Page } from '@playwright/test';
import electronModule from 'electron';
import type { ShellProbe } from '../src/main/shell';

const appDir = fileURLToPath(new URL('..', import.meta.url));
// The `electron` package's main export is the path to its binary, not the API surface it types.
const electronBinary = electronModule as unknown as string;

export type App = Awaited<ReturnType<typeof electron.launch>>;

/** Launches against a throwaway profile unless the caller reuses one to test a relaunch. */
export async function launch(
  userData = mkdtempSync(join(tmpdir(), 'time-stop-e2e-')),
): Promise<{ app: App; window: Page }> {
  const app = await electron.launch({
    args: [appDir],
    env: { ...process.env, TIME_STOP_PROFILE_DIR: userData, TIME_STOP_HEADLESS: '1' },
  });
  return { app, window: await app.firstWindow() };
}

/** Starts another process against a profile already in use, resolving with its exit code. */
export function launchAgain(userData: string): Promise<number | null> {
  return new Promise((resolve) => {
    execFile(electronBinary, [appDir], {
      env: { ...process.env, TIME_STOP_PROFILE_DIR: userData, TIME_STOP_HEADLESS: '1' },
    }).on('exit', resolve);
  });
}

/** Shell state the renderer cannot see: what the main process put on the window and the Dock. */
export const shellState = {
  windowTitle: (app: App): Promise<string> =>
    app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getTitle()),
  windowSize: (app: App): Promise<number[]> =>
    app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getSize()),
  resize: (app: App, width: number, height: number): Promise<void> =>
    app.evaluate(
      ({ BrowserWindow }, size) =>
        BrowserWindow.getAllWindows()[0]!.setSize(size.width, size.height),
      { width, height },
    ),
  alwaysOnTop: (app: App): Promise<boolean> =>
    app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isAlwaysOnTop()),
  dockBadge: (app: App): Promise<string> =>
    app.evaluate((electronApp) => electronApp.app.dock?.getBadge() ?? ''),
  timerMenuItem: (app: App): Promise<{ label: string; accelerator: string | null } | null> =>
    app.evaluate(({ Menu }) => {
      const item = Menu.getApplicationMenu()?.getMenuItemById('timer:startStop');
      return item ? { label: item.label, accelerator: item.accelerator } : null;
    }),
  clickTimerMenuItem: (app: App): Promise<void> =>
    app.evaluate(({ Menu }) => {
      Menu.getApplicationMenu()?.getMenuItemById('timer:startStop')?.click();
    }),
  hotkeyRegistered: (app: App, accelerator: string): Promise<boolean> =>
    app.evaluate(({ globalShortcut }, key) => globalShortcut.isRegistered(key), accelerator),
  trayLine: (app: App): Promise<string> =>
    app.evaluate(
      () =>
        (globalThis as typeof globalThis & { timeStopShell?: ShellProbe }).timeStopShell
          ?.trayLine ?? '',
    ),
};
