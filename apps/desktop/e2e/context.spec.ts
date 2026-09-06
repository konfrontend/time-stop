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

test('a Project made in Settings becomes the Context and survives relaunch', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'time-stop-e2e-'));
  const shots = process.env['E2E_SHOTS'];

  const first = await launch(userData);
  const { window } = first;
  await window.getByRole('link', { name: 'Settings' }).click();
  const projects = window.locator('[data-slot="projects-section"]');
  await projects.getByLabel('Name').fill('Acme API');
  await projects.getByLabel('Rate per hour').fill('110');
  await projects.getByRole('button', { name: 'Add Project' }).click();
  await expect(projects.getByText('Acme API')).toBeVisible();
  if (shots) await window.screenshot({ path: join(shots, 'settings.png'), fullPage: true });

  await window.getByRole('link', { name: 'Tracker' }).click();
  await window.getByLabel('Project').selectOption({ label: 'Acme API' });
  await window.getByRole('button', { name: 'Start' }).click();
  await expect(window.locator('[data-slot="timer-status"]')).toHaveText('Timer running');
  if (shots) await window.screenshot({ path: join(shots, 'tracker.png') });
  await first.app.close();

  const second = await launch(userData);
  await expect(second.window.getByLabel('Project')).toHaveValue(/./);
  const picked = second.window.getByLabel('Project').locator('option:checked');
  await expect(picked).toHaveText('Acme API');
  await second.app.close();
});
