import { fileURLToPath } from 'node:url';
import { _electron as electron, type Page } from '@playwright/test';

const appDir = fileURLToPath(new URL('..', import.meta.url));

export type App = Awaited<ReturnType<typeof electron.launch>>;

export async function launch(userData: string): Promise<{ app: App; window: Page }> {
  const app = await electron.launch({
    args: [appDir],
    env: { ...process.env, TIME_STOP_PROFILE_DIR: userData },
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
  hotkeyRegistered: (app: App, accelerator: string): Promise<boolean> =>
    app.evaluate(({ globalShortcut }, key) => globalShortcut.isRegistered(key), accelerator),
};
