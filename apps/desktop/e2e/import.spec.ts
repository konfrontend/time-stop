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
  // Import sits on the Workspace row and shows on hover.
  await window.locator('[data-slot="workspaces-list"]').getByRole('listitem').first().hover();
  await window.getByRole('button', { name: 'Import into Default' }).click();
  const popover = window.locator('[data-slot="import-popover"]');
  await popover.getByLabel('Time zone of the export').click();
  await window.getByRole('option', { name: 'UTC', exact: true }).click();
  await popover.getByRole('button', { name: /Choose CSV/ }).click();

  await expect(popover).toContainText('Imported 6 Records, 5 Projects, 0 Clients from toggl.csv.');
  await expect(window.locator('[data-slot="projects-list"]')).toContainText('LDSTR');

  // A second run over the same export leaves the history as it is.
  await popover.getByRole('button', { name: /Choose CSV/ }).click();
  await expect(popover).toContainText('6 entries were already here');

  await app.close();
});
