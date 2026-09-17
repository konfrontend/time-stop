import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { launch, shellState } from './app';

/**
 * What only a real launch can prove: the window comes up, a Timer runs and titles it, quitting
 * stops it, and the next launch finds the Record. What the Tracker draws is the unit tests' job.
 */
test('launch, run a Timer, quit stops it, relaunch finds the Record', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'time-stop-e2e-'));

  const first = await launch(userData);
  const dial = first.window.locator('[data-slot="timer-dial"]');
  await expect(dial).not.toHaveAttribute('data-running');
  await expect.poll(() => shellState.windowTitle(first.app)).toBe('Time Stop');
  await dial.click();
  await expect(dial).toHaveAttribute('data-running');
  await expect
    .poll(() => shellState.windowTitle(first.app))
    .toMatch(/^Time Stop — \d{2}:\d{2}:\d{2}$/);
  await first.window.locator('[data-slot="name-field"]').fill('Smoke');
  await first.window.locator('[data-slot="name-field"]').blur();
  await first.app.close();

  const second = await launch(userData);
  // The Timer never outlives the app: the quit stopped it, and the Record it left is listed.
  await expect(second.window.locator('[data-slot="timer-dial"]')).not.toHaveAttribute(
    'data-running',
  );
  await expect.poll(() => shellState.windowTitle(second.app)).toBe('Time Stop');
  await expect(second.window.locator('[data-slot="record-row"]')).toHaveCount(1);

  await second.window.getByRole('link', { name: 'Dashboard' }).click();
  await expect(second.window.locator('[data-slot="totals-bar"]')).toContainText('1 Record');
  await second.app.close();
});
