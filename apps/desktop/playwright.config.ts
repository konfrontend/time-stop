import { defineConfig } from '@playwright/test';

// Runs against the built app; `test:e2e` builds it first.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
});
