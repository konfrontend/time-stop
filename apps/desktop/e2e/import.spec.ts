import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { launch, type App } from './app';

const fixture = fileURLToPath(new URL('../src/main/imports/fixtures/toggl.csv', import.meta.url));

/** The file dialog is native, so the test answers it from the main process. */
async function chooseFile(app: App, path: string): Promise<void> {
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
  }, path);
}

test('import a Toggl export from Settings', async () => {
  const { app, window } = await launch();
  await chooseFile(app, fixture);

  await window.getByRole('link', { name: 'Settings' }).click();
  await window.locator('[data-slot="settings"]').getByRole('tab', { name: 'Workspaces' }).click();
  // One Import for the page, in its footer; the popover picks the Workspace.
  await window.locator('[data-slot="workspaces-footer"]').getByRole('button').click();
  const popover = window.locator('[data-slot="import-popover"]');
  await popover.getByLabel('Workspace').click();
  await window.getByRole('option', { name: 'Default', exact: true }).click();
  await popover.getByLabel('Time zone of the export').click();
  await window.getByRole('option', { name: 'UTC', exact: true }).click();
  await popover.getByRole('button', { name: /Choose CSV/ }).click();

  await expect(popover).toContainText('Imported 6 Records, 5 Projects, 0 Clients from toggl.csv.');

  // A second run over the same export leaves the history as it is.
  await popover.getByRole('button', { name: /Choose CSV/ }).click();
  await expect(popover).toContainText('6 entries were already here');

  await window.keyboard.press('Escape');
  const workspace = window.locator('[data-slot="workspace-group"]').first();
  await workspace.getByRole('tab', { name: 'Projects' }).click();
  await expect(window.locator('[data-slot="projects-list"]')).toContainText('LDSTR');

  await app.close();
});
