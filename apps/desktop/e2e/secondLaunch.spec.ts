import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { launch, launchAgain } from './app';

test('a second launch raises the running window instead of starting a second app', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'time-stop-e2e-'));
  const { app, window } = await launch(userData);
  await expect(window.locator('[data-slot="timer-dial"]')).toBeVisible();
  const visible = (): Promise<boolean> =>
    app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isVisible());
  // Headless runs never map the window, which leaves the raise plain to see.
  expect(await visible()).toBe(false);

  expect(await launchAgain(userData)).toBe(0);

  await expect.poll(visible).toBe(true);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  await app.close();
});
