import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { launch } from './app';

test('the dial starts on Enter, offers Continue, and Clear starts something new', async () => {
  const { app, window } = await launch();
  const dial = window.locator('[data-slot="timer-dial"]');
  const name = window.locator('[data-slot="name-field"]');

  await expect(dial).toHaveAttribute('data-standby', 'start');
  await name.fill('Build header');
  await name.press('Enter');
  await expect(dial).toHaveAttribute('data-running');
  await expect(window.getByRole('button', { name: 'Pause Build header' })).toBeVisible();

  await window.getByRole('button', { name: 'Pause' }).click();
  await expect(dial).toHaveAttribute('data-standby', 'continue');
  await expect(name).toHaveValue('Build header');
  await expect(window.getByRole('button', { name: 'Continue Build header' })).toBeVisible();

  await window.getByRole('button', { name: 'Clear' }).click();
  await expect(dial).toHaveAttribute('data-standby', 'start');
  await expect(name).toHaveValue('');
  await expect(name).toBeFocused();
  await app.close();
});

test('a row continues its activity, and the list collapses across a relaunch', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'time-stop-e2e-'));
  const first = await launch(userData);
  const dial = first.window.locator('[data-slot="timer-dial"]');
  const name = first.window.locator('[data-slot="name-field"]');

  await name.fill('Ch. 7 modules');
  await name.press('Enter');
  await first.window.getByRole('button', { name: 'Pause' }).click();
  await first.window.getByRole('button', { name: 'Clear' }).click();

  const row = first.window.locator('[data-slot="record-row"]').first();
  await row.hover();
  await row.getByRole('button', { name: 'Continue' }).click();
  await expect(dial).toHaveAttribute('data-running');
  await expect(name).toHaveValue('Ch. 7 modules');
  await first.window.getByRole('button', { name: 'Pause' }).click();

  await first.window.getByRole('button', { name: 'Recent Records' }).click();
  await expect(first.window.locator('[data-slot="recent"]')).toHaveCount(0);
  await first.app.close();

  const second = await launch(userData);
  await expect(second.window.locator('[data-slot="timer-dial"]')).toBeVisible();
  await expect(second.window.locator('[data-slot="recent"]')).toHaveCount(0);
  await second.window.getByRole('button', { name: 'Recent Records' }).click();
  await expect(second.window.locator('[data-slot="recent"]')).toBeVisible();
  await second.app.close();
});
