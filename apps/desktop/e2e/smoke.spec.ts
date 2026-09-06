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
    env: { ...process.env, TIME_STOP_USER_DATA: userData },
  });
  return { app, window: await app.firstWindow() };
}

test('launch, Start, relaunch, Stop', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'time-stop-e2e-'));

  const first = await launch(userData);
  const status = first.window.locator('[data-slot="timer-status"]');
  await expect(status).toHaveText('Ready');
  await first.window.getByRole('button', { name: 'Start' }).click();
  await expect(status).toHaveText('Timer running');
  await first.window.getByLabel('Name').fill('Smoke');
  await first.window.getByLabel('Name').blur();
  await first.app.close();

  // Quitting mid-Timer and relaunching shows the same Timer still running.
  const second = await launch(userData);
  const status2 = second.window.locator('[data-slot="timer-status"]');
  await expect(status2).toHaveText('Timer running');
  await expect(second.window.getByLabel('Name')).toHaveValue('Smoke');
  await second.window.getByRole('button', { name: 'Stop' }).click();
  await expect(status2).toHaveText('Ready');
  await expect(second.window.getByLabel('Name')).toHaveValue('Smoke');
  await second.app.close();
});
