import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { launch, shellState } from './app';

test('launch, Start, quit stops the Timer, relaunch', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'time-stop-e2e-'));

  const first = await launch(userData);
  const dial = first.window.locator('[data-slot="timer-dial"]');
  const name = first.window.locator('[data-slot="name-field"]');
  await expect(dial).not.toHaveAttribute('data-running');
  await expect.poll(() => shellState.windowTitle(first.app)).toBe('Time Stop');
  await dial.click();
  await expect(dial).toHaveAttribute('data-running');
  await expect
    .poll(() => shellState.windowTitle(first.app))
    .toMatch(/^Time Stop — \d{2}:\d{2}:\d{2}$/);
  await name.fill('Smoke');
  await name.blur();
  await first.app.close();

  const second = await launch(userData);
  const dial2 = second.window.locator('[data-slot="timer-dial"]');
  const name2 = second.window.locator('[data-slot="name-field"]');
  await expect(dial2).not.toHaveAttribute('data-running');
  // Standby goes on with the Record the last session left: the dial offers it under its Name.
  await expect(dial2).toHaveAttribute('data-standby', 'continue');
  await expect(name2).toHaveValue('Smoke');
  await name2.fill('Smoke again');
  await dial2.click();
  await expect(dial2).toHaveAttribute('data-running');
  await expect(name2).toHaveValue('Smoke again');
  await dial2.click();
  await expect(dial2).not.toHaveAttribute('data-running');
  await expect.poll(() => shellState.windowTitle(second.app)).toBe('Time Stop');
  // The Tracker lists what was tracked: two Names on no Project, so two activities.
  await expect(second.window.locator('[data-slot="record-row"]')).toHaveCount(2);

  await second.window.getByRole('link', { name: 'Dashboard' }).click();
  const rows = second.window.locator('[data-slot="record-row"]');
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: 'Smoke' })).toHaveCount(2);
  await expect(second.window.locator('[data-slot="totals-bar"]')).toContainText('2 Records');
  await second.app.close();
});
