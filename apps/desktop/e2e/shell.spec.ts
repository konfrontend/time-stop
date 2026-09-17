import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { launch, shellState } from './app';

const GLOBAL_HOTKEY = 'CommandOrControl+Alt+S';

test('the Timer menu item toggles the Timer and shows its shortcut', async () => {
  const { app, window } = await launch();
  const dial = window.locator('[data-slot="timer-dial"]');

  await expect(dial).not.toHaveAttribute('data-running');
  expect(await shellState.timerMenuItem(app)).toEqual({
    label: 'Start',
    accelerator: 'CommandOrControl+S',
  });

  await shellState.clickTimerMenuItem(app);
  await expect(dial).toHaveAttribute('data-running');
  await expect.poll(async () => (await shellState.timerMenuItem(app))?.label).toBe('Pause');

  await shellState.clickTimerMenuItem(app);
  await expect(dial).not.toHaveAttribute('data-running');
  await app.close();
});

test('always on top and the window size survive relaunch; tabs keep the size', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'time-stop-e2e-'));

  const first = await launch(userData);
  expect(await shellState.hotkeyRegistered(first.app, GLOBAL_HOTKEY)).toBe(true);
  expect(await shellState.alwaysOnTop(first.app)).toBe(false);
  await expect.poll(() => shellState.windowSize(first.app)).toEqual([420, 640]);

  await first.window.getByRole('link', { name: 'Dashboard' }).click();
  await expect(first.window.locator('[data-slot="dashboard"]')).toBeVisible();
  expect(await shellState.windowSize(first.app)).toEqual([420, 640]);
  await first.window.getByRole('link', { name: 'Tracker' }).click();

  await shellState.resize(first.app, 500, 700);
  await first.window.getByRole('button', { name: 'Always on top' }).click();
  await expect.poll(() => shellState.alwaysOnTop(first.app)).toBe(true);
  // The size is saved a moment after the resize settles.
  await first.window.waitForTimeout(600);
  await first.app.close();

  const second = await launch(userData);
  expect(await shellState.alwaysOnTop(second.app)).toBe(true);
  expect(await shellState.windowSize(second.app)).toEqual([500, 700]);
  await expect(second.window.getByRole('button', { name: 'Always on top' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await second.app.close();
});

test('on standby the tray line follows the Context', async () => {
  const { app, window } = await launch();
  await expect(window.locator('[data-slot="timer-dial"]')).not.toHaveAttribute('data-running');
  await expect.poll(() => shellState.trayLine(app)).toBe('Default');

  await window.getByRole('link', { name: 'Settings' }).click();
  await window.locator('[data-slot="settings"]').getByRole('tab', { name: 'Workspaces' }).click();
  const tab = window.locator('[data-slot="workspaces-tab"]');
  await tab.getByRole('button', { name: 'New Workspace' }).click();
  // The editor auto-applies: Enter commits the Name, which creates the Workspace.
  const name = window.locator('[data-slot="popover-content"]').getByLabel('Name');
  await name.fill('Personal');
  await name.press('Enter');
  await expect(tab.locator('[data-slot="workspace-name"]').last()).toHaveValue('Personal');
  await window.keyboard.press('Escape');

  await window.getByRole('button', { name: 'Switch Workspace' }).click();
  await window.getByRole('menuitemradio', { name: 'Personal' }).click();
  await expect.poll(() => shellState.trayLine(app)).toBe('Personal');
  await app.close();
});

// Kept out of the smoke test so the rest of that path still runs on the platforms without a Dock.
test('the Dock badge follows the Timer', async () => {
  test.skip(process.platform !== 'darwin', 'app.dock is macOS-only');

  const { app, window } = await launch();
  const dial = window.locator('[data-slot="timer-dial"]');

  await expect(dial).not.toHaveAttribute('data-running');
  await expect.poll(() => shellState.dockBadge(app)).toBe('');

  await dial.click();
  await expect(dial).toHaveAttribute('data-running');
  await expect.poll(() => shellState.dockBadge(app)).toBe('●');

  await dial.click();
  await expect(dial).not.toHaveAttribute('data-running');
  await expect.poll(() => shellState.dockBadge(app)).toBe('');
  await app.close();
});

// The Windows counterpart of the Dock badge, and the tray glyph drawn for the taskbar it sits on.
test.describe('on Windows', () => {
  test.skip(process.platform !== 'win32', 'Windows shell affordances');

  test('the taskbar overlay and the tray glyph follow the Timer', async () => {
    const { app, window } = await launch();
    const dial = window.locator('[data-slot="timer-dial"]');

    await expect.poll(() => shellState.trayIcon(app)).toMatch(/^trayStandbyOn(Dark|Light)\.png$/);
    expect(await shellState.taskbarOverlay(app)).toBe(false);

    await dial.click();
    await expect(dial).toHaveAttribute('data-running');
    await expect.poll(() => shellState.trayIcon(app)).toMatch(/^trayRecordingOn(Dark|Light)\.png$/);
    await expect.poll(() => shellState.taskbarOverlay(app)).toBe(true);

    await dial.click();
    await expect(dial).not.toHaveAttribute('data-running');
    await expect.poll(() => shellState.taskbarOverlay(app)).toBe(false);
    await app.close();
  });

  test('a left-click on the tray icon opens the window', async () => {
    const { app } = await launch();
    expect(await shellState.windowVisible(app)).toBe(false);

    await shellState.clickTray(app);
    await expect.poll(() => shellState.windowVisible(app)).toBe(true);
    await app.close();
  });
});

test('ending the session stops the Timer', async () => {
  const { app, window } = await launch();
  const dial = window.locator('[data-slot="timer-dial"]');

  await dial.click();
  await expect(dial).toHaveAttribute('data-running');

  await shellState.endSession(app);
  await expect(dial).not.toHaveAttribute('data-running');
  await app.close();
});
