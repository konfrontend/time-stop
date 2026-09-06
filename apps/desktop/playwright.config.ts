import { defineConfig } from '@playwright/test';

// Runs against the built app: `npm run build` first.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
});
