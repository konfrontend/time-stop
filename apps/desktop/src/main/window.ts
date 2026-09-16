import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, nativeImage, shell } from 'electron';
import type { Preferences } from '@time-stop/db';
import { APP_NAME } from './shellText';

/** One window size for every tab; the Owner's last resize is what the next launch opens with. */
export const DEFAULT_WINDOW_SIZE = { width: 420, height: 640 };
export const MIN_WINDOW_SIZE = { width: 360, height: 500 };

const SAVE_SIZE_DELAY_MS = 300;

export function createWindow(preferences: Preferences): BrowserWindow {
  const window = new BrowserWindow({
    ...(preferences.windowSize() ?? DEFAULT_WINDOW_SIZE),
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height,
    title: APP_NAME,
    // Windows and Linux draw the window and taskbar icon from here; macOS takes the bundle's.
    icon: nativeImage.createFromPath(
      fileURLToPath(new URL('../../resources/icon.png', import.meta.url)),
    ),
    show: false,
    alwaysOnTop: preferences.isAlwaysOnTop(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.cjs', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // A never-shown window is throttled by macOS; the e2e runs need it rendering anyway.
      backgroundThrottling: false,
    },
  });

  // Headless runs drive the window without ever mapping it on screen.
  if (!process.env['TIME_STOP_HEADLESS']) window.on('ready-to-show', () => window.show());
  // The elapsed Timer owns the title; the page's own <title> must not take it back.
  window.on('page-title-updated', (event) => event.preventDefault());

  // Maximized and full-screen sizes are the OS's, not a preference.
  let save: ReturnType<typeof setTimeout> | undefined;
  window.on('resize', () => {
    clearTimeout(save);
    save = setTimeout(() => {
      if (window.isDestroyed() || window.isMaximized() || window.isFullScreen()) return;
      const [width, height] = window.getSize();
      preferences.setWindowSize({ width: width!, height: height! });
    }, SAVE_SIZE_DELAY_MS);
  });
  window.on('closed', () => clearTimeout(save));

  // External links open in the OS browser, never inside the app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void window.loadFile(fileURLToPath(new URL('../renderer/index.html', import.meta.url)));
  }

  return window;
}
