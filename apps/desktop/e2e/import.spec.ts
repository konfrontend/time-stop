import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { launch, type App } from './app';

const fixture = fileURLToPath(
  new URL('../../../packages/toggl-import/src/fixtures/toggl.csv', import.meta.url),
);

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
  const section = window.locator('[data-slot="import-section"]');
  await section.getByLabel('Time zone of the export').selectOption('UTC');
  await section.getByRole('button', { name: /Choose CSV/ }).click();

  await expect(section).toContainText('Imported 6 Records, 5 Projects, 0 Clients from toggl.csv.');
  await expect(window.locator('[data-slot="projects-section"]')).toContainText('LDSTR');

  // A second run over the same export leaves the history as it is.
  await section.getByRole('button', { name: /Choose CSV/ }).click();
  await expect(section).toContainText('6 entries were already here');

  await app.close();
});
