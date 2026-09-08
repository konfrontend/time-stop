import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect, test, type Page } from '@playwright/test';

const appDir = fileURLToPath(new URL('..', import.meta.url));

type App = Awaited<ReturnType<typeof electron.launch>>;

async function launch(userData: string): Promise<{ app: App; window: Page }> {
  const app = await electron.launch({
    args: [appDir],
    env: { ...process.env, TIME_STOP_PROFILE_DIR: userData },
  });
  return { app, window: await app.firstWindow() };
}

function alwaysOnTop(app: App): Promise<boolean> {
  return app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isAlwaysOnTop());
}

function windowWidth(app: App): Promise<number> {
  return app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getSize()[0]!);
}

function hotkeyRegistered(app: App): Promise<boolean> {
  return app.evaluate(({ globalShortcut }) =>
    globalShortcut.isRegistered('CommandOrControl+Alt+T'),
  );
}

test('always on top survives relaunch and tabs resize the window', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'time-stop-e2e-'));

  const first = await launch(userData);
  expect(await hotkeyRegistered(first.app)).toBe(true);
  expect(await alwaysOnTop(first.app)).toBe(false);
  await expect.poll(() => windowWidth(first.app)).toBe(420);

  await first.window.getByRole('link', { name: 'Dashboard' }).click();
  await expect.poll(() => windowWidth(first.app)).toBe(1000);
  await first.window.getByRole('link', { name: 'Tracker' }).click();
  await expect.poll(() => windowWidth(first.app)).toBe(420);

  await first.window.getByRole('button', { name: 'Always on top' }).click();
  await expect.poll(() => alwaysOnTop(first.app)).toBe(true);
  await first.app.close();

  const second = await launch(userData);
  expect(await alwaysOnTop(second.app)).toBe(true);
  await expect(second.window.getByRole('button', { name: 'Always on top' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await second.app.close();
});
