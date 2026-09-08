import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect, test, type Page } from '@playwright/test';

const appDir = fileURLToPath(new URL('..', import.meta.url));

async function launch(
  userData: string,
): Promise<{ app: Awaited<ReturnType<typeof electron.launch>>; window: Page }> {
  const app = await electron.launch({
    args: [appDir],
    env: { ...process.env, TIME_STOP_PROFILE_DIR: userData },
  });
  return { app, window: await app.firstWindow() };
}

type App = Awaited<ReturnType<typeof electron.launch>>;

function windowTitle(app: App): Promise<string> {
  return app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getTitle());
}

function dockBadge(app: App): Promise<string> {
  return app.evaluate((electronApp) => electronApp.app.dock?.getBadge() ?? '');
}

test('launch, Start, quit stops the Timer, relaunch', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'time-stop-e2e-'));

  const first = await launch(userData);
  const status = first.window.locator('[data-slot="timer-status"]');
  await expect(status).toHaveText('Ready');
  await expect.poll(() => windowTitle(first.app)).toBe('Time Stop');
  await first.window.getByRole('button', { name: 'Start' }).click();
  await expect(status).toHaveText('Timer running');
  // The shell carries the Timer past the window: the title counts, the Dock badge shows.
  await expect.poll(() => windowTitle(first.app)).toMatch(/^Time Stop — \d{2}:\d{2}:\d{2}$/);
  await expect.poll(() => dockBadge(first.app)).toBe('●');
  await first.window.getByLabel('Name').fill('Smoke');
  await first.window.getByLabel('Name').blur();
  await first.app.close();

  const second = await launch(userData);
  const status2 = second.window.locator('[data-slot="timer-status"]');
  await expect(status2).toHaveText('Ready');
  await expect(second.window.getByLabel('Name')).toHaveValue('Smoke');
  await second.window.getByRole('button', { name: 'Start' }).click();
  await expect(status2).toHaveText('Timer running');
  await second.window.getByRole('button', { name: 'Stop' }).click();
  await expect(status2).toHaveText('Ready');
  await expect.poll(() => windowTitle(second.app)).toBe('Time Stop');
  await expect.poll(() => dockBadge(second.app)).toBe('');

  await second.window.getByRole('link', { name: 'Dashboard' }).click();
  const rows = second.window.locator('[data-slot="record-row"]');
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: 'Smoke' })).toHaveCount(1);
  await expect(second.window.locator('[data-slot="totals-bar"]')).toContainText('2 Records');
  await second.app.close();
});
