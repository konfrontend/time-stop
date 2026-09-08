import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, shell } from 'electron';
import type { WindowMode } from '../shared/shell.js';
import { APP_NAME } from './shellText.js';

export const windowSizes: { [mode in WindowMode]: { width: number; height: number } } = {
  compact: { width: 420, height: 640 },
  expanded: { width: 1000, height: 760 },
};

const modes = new WeakMap<BrowserWindow, WindowMode>();

export function createWindow(alwaysOnTop: boolean): BrowserWindow {
  const window = new BrowserWindow({
    ...windowSizes.compact,
    title: APP_NAME,
    show: false,
    alwaysOnTop,
    autoHideMenuBar: true,
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.cjs', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.on('ready-to-show', () => window.show());
  // The elapsed Timer owns the title; the page's own <title> must not take it back.
  window.on('page-title-updated', (event) => event.preventDefault());
  // A window that comes back from maximized or full screen returns to the open tab's size.
  const restore = () => applyWindowMode(window, modes.get(window) ?? 'compact');
  window.on('unmaximize', restore);
  window.on('leave-full-screen', restore);

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

/** Resizes in place: the window keeps its position while a tab asks for more or less room. */
export function applyWindowMode(window: BrowserWindow, mode: WindowMode): void {
  modes.set(window, mode);
  if (window.isMaximized() || window.isFullScreen()) return;
  const { width, height } = windowSizes[mode];
  window.setSize(width, height, false);
}
