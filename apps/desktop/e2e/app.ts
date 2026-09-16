import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, type Page } from '@playwright/test';
import electronModule from 'electron';

const appDir = fileURLToPath(new URL('..', import.meta.url));
// The `electron` package's main export is the path to its binary, not the API surface it types.
const electronBinary = electronModule as unknown as string;

export type App = Awaited<ReturnType<typeof electron.launch>>;

export type SecondLaunch = { code: number | null; signal: NodeJS.Signals | null; stderr: string };

const headlessProfile = (userData: string) => ({
  ...process.env,
  TIME_STOP_PROFILE_DIR: userData,
  TIME_STOP_HEADLESS: '1',
});

/** Launches against a throwaway profile unless the caller reuses one to test a relaunch. */
export async function launch(
  userData = mkdtempSync(join(tmpdir(), 'time-stop-e2e-')),
): Promise<{ app: App; window: Page }> {
  const app = await electron.launch({
    args: [appDir],
    env: headlessProfile(userData),
  });
  return { app, window: await app.firstWindow() };
}

/**
 * Launches an installed build: the packaged executable carries its own Electron and asar. Unlike
 * the other launches this one maps its window, which is what a Windows user gets or does not.
 */
export async function launchPackaged(executablePath: string): Promise<{ app: App; window: Page }> {
  const app = await electron.launch({
    executablePath,
    env: {
      ...process.env,
      TIME_STOP_PROFILE_DIR: mkdtempSync(join(tmpdir(), 'time-stop-packaged-')),
    },
  });
  return { app, window: await app.firstWindow() };
}

/**
 * Starts another process against a profile already in use. Resolves with how it ended, signal and
 * stderr included: a second launch that dies instead of quitting reads as a plain exit otherwise.
 */
export function launchAgain(userData: string): Promise<SecondLaunch> {
  return new Promise((resolve) => {
    let stderr = '';
    // Playwright's own launch passes --no-sandbox; an unpacked chrome-sandbox aborts without it.
    const child = execFile(electronBinary, [appDir, '--no-sandbox'], {
      env: headlessProfile(userData),
    });
    child.stderr?.on('data', (chunk: Buffer | string) => (stderr += chunk));
    child.on('exit', (code, signal) => resolve({ code, signal, stderr: stderr.trim() }));
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
    app.evaluate(() => globalThis.timeStopShell?.trayLine ?? ''),
  trayIcon: (app: App): Promise<string> =>
    app.evaluate(() => globalThis.timeStopShell?.trayIcon ?? ''),
  taskbarOverlay: (app: App): Promise<boolean> =>
    app.evaluate(() => globalThis.timeStopShell?.taskbarOverlay ?? false),
  clickTray: (app: App): Promise<void> =>
    app.evaluate(() => {
      globalThis.timeStopShell?.clickTray();
    }),
  windowVisible: (app: App): Promise<boolean> =>
    app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible() ?? false),
  /** What Windows fires on logoff and shutdown; only a window hears it. */
  endSession: (app: App): Promise<void> =>
    app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]!.emit('session-end');
    }),
};
