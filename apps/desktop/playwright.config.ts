import { defineConfig } from '@playwright/test';

// Runs against the built app in `out/`: build before this, as CI does.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
});
