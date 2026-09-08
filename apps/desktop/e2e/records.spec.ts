import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect, test } from '@playwright/test';

const appDir = fileURLToPath(new URL('..', import.meta.url));

test('add, edit and delete a Record from the Dashboard', async () => {
  const app = await electron.launch({
    args: [appDir],
    env: { ...process.env, TIME_STOP_PROFILE_DIR: mkdtempSync(join(tmpdir(), 'time-stop-e2e-')) },
  });
  const window = await app.firstWindow();
  await window.getByRole('link', { name: 'Dashboard' }).click();
  const rows = window.locator('[data-slot="record-row"]');
  await expect(rows).toHaveCount(0);

  await window.getByRole('button', { name: '+ Add Record' }).click();
  const dialog = window.locator('[data-slot="record-dialog"]');
  await dialog.getByLabel('Start').fill('09:00');
  await dialog.getByLabel('Stop').fill('08:00');
  await dialog.getByRole('button', { name: 'Add Record' }).click();
  await expect(dialog).toContainText('Stop must not precede start');
  await dialog.getByLabel('Stop').fill('10:30');
  await dialog.getByLabel('Name').fill('By hand');
  await dialog.getByRole('button', { name: 'Add Record' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('By hand');
  await expect(rows.first()).toContainText('1:30');

  await rows.first().click();
  await dialog.getByLabel('Name').fill('Edited');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(rows.first()).toContainText('Edited');

  await rows.first().click();
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await window.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(rows).toHaveCount(0);
  await app.close();
});
