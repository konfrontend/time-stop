import { expect, test } from '@playwright/test';
import { launchPackaged, shellState } from './app';

const executable = process.env['TIME_STOP_PACKAGED_APP'];

// Nobody opens a release on a real Windows machine, so this runs against the build about to ship.
test.skip(!executable, 'Set TIME_STOP_PACKAGED_APP to the packaged executable.');

test('the packaged build starts and shows the Tracker', async () => {
  const { app, window } = await launchPackaged(executable!);
  await expect(window.locator('[data-slot="timer-dial"]')).toBeVisible();
  await expect(window.getByRole('button', { name: 'Start' })).toBeVisible();
  await expect.poll(() => shellState.windowTitle(app)).toBe('Time Stop');
  await app.close();
});
