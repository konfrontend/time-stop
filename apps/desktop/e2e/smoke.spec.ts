import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { launch, shellState } from './app';

test('launch, Start, quit stops the Timer, relaunch', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'time-stop-e2e-'));

  const first = await launch(userData);
  const dial = first.window.locator('[data-slot="timer-dial"]');
  await expect(dial).not.toHaveAttribute('data-running');
  await expect.poll(() => shellState.windowTitle(first.app)).toBe('Time Stop');
  await first.window.getByRole('button', { name: 'Start' }).click();
  await expect(dial).toHaveAttribute('data-running');
  await expect
    .poll(() => shellState.windowTitle(first.app))
    .toMatch(/^Time Stop — \d{2}:\d{2}:\d{2}$/);
  await first.window.getByLabel('Name').fill('Smoke');
  await first.window.getByLabel('Name').blur();
  await first.app.close();

  const second = await launch(userData);
  const dial2 = second.window.locator('[data-slot="timer-dial"]');
  await expect(dial2).not.toHaveAttribute('data-running');
  // Standby names the next Timer, not the last Record; the Name typed here rides on the Start.
  await expect(second.window.getByLabel('Name')).toHaveValue('');
  await second.window.getByLabel('Name').fill('Smoke again');
  await second.window.getByRole('button', { name: 'Start' }).click();
  await expect(dial2).toHaveAttribute('data-running');
  await expect(second.window.getByLabel('Name')).toHaveValue('Smoke again');
  await second.window.getByRole('button', { name: 'Stop' }).click();
  await expect(dial2).not.toHaveAttribute('data-running');
  await expect.poll(() => shellState.windowTitle(second.app)).toBe('Time Stop');
  // The Tracker lists what was tracked: both Records sit on no Project, so they fold into one run.
  await second.window.getByRole('button', { name: 'Recent Records' }).click();
  await second.window.locator('[data-slot="record-run"] button').first().click();
  await expect(second.window.locator('[data-slot="record-row"]')).toHaveCount(2);

  await second.window.getByRole('link', { name: 'Dashboard' }).click();
  const rows = second.window.locator('[data-slot="record-row"]');
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: 'Smoke' })).toHaveCount(2);
  await expect(second.window.locator('[data-slot="totals-bar"]')).toContainText('2 Records');
  await second.app.close();
});
