import { expect, test } from '@playwright/test';
import desktopPackage from '../package.json' with { type: 'json' };
import { launchPackaged, shellState } from './app';

const { productName } = desktopPackage;

const executable = process.env['DESKTOP_PACKAGED_APP'];

// Stands in for the hands-on check nobody makes on Windows. See docs/release.md.
test.skip(!executable, 'Set DESKTOP_PACKAGED_APP to the packaged executable.');

test('the packaged build starts and shows the Tracker', async () => {
  const { app, window } = await launchPackaged(executable!);
  await expect(window.locator('[data-slot="timer-dial"]')).toBeVisible();
  await expect(window.getByRole('button', { name: 'Start' })).toBeVisible();
  await expect.poll(() => shellState.windowTitle(app)).toBe(productName);
  await expect
    .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isVisible()))
    .toBe(true);
  await app.close();
});
