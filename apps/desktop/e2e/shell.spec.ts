import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { launch, shellState } from './app.js';

const HOTKEY = 'CommandOrControl+Alt+T';

test('always on top survives relaunch and tabs resize the window', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'time-stop-e2e-'));

  const first = await launch(userData);
  expect(await shellState.hotkeyRegistered(first.app, HOTKEY)).toBe(true);
  expect(await shellState.alwaysOnTop(first.app)).toBe(false);
  await expect.poll(() => shellState.windowWidth(first.app)).toBe(420);

  await first.window.getByRole('link', { name: 'Dashboard' }).click();
  await expect.poll(() => shellState.windowWidth(first.app)).toBe(1000);
  await first.window.getByRole('link', { name: 'Tracker' }).click();
  await expect.poll(() => shellState.windowWidth(first.app)).toBe(420);

  await first.window.getByRole('button', { name: 'Always on top' }).click();
  await expect.poll(() => shellState.alwaysOnTop(first.app)).toBe(true);
  await first.app.close();

  const second = await launch(userData);
  expect(await shellState.alwaysOnTop(second.app)).toBe(true);
  await expect(second.window.getByRole('button', { name: 'Always on top' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await second.app.close();
});
