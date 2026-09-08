import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, type Page } from '@playwright/test';

const appDir = fileURLToPath(new URL('..', import.meta.url));

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

/** Shell state the renderer cannot see: what the main process put on the window and the Dock. */
export const shellState = {
  windowTitle: (app: App): Promise<string> =>
    app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getTitle()),
  windowWidth: (app: App): Promise<number> =>
    app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getSize()[0]!),
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
};
