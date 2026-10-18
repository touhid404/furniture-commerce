import { defineConfig } from '@playwright/test';
const port = process.env.E2E_PORT ?? '3002';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 1000 },
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `PORT=${port} npm start`,
    url: `http://127.0.0.1:${port}/api/v1/health/live`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  reporter: 'list',
});
