import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 45_000,
  use: { baseURL: 'http://127.0.0.1:3001', viewport: { width: 1440, height: 900 }, channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: { command: 'npm start', url: 'http://127.0.0.1:3001/api/v1/health/live', reuseExistingServer: !process.env.CI, timeout: 30_000 },
  reporter: 'list',
});
