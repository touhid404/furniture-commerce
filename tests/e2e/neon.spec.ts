import { test, expect } from '@playwright/test';

test('React -> Express -> Prisma -> Neon connection and JSON branding', async ({ page, request }) => {
  const response = await request.get('/api/v1/config');
  expect(response.ok()).toBeTruthy();
  const { data: config } = await response.json();
  await page.goto('/');
  await expect(page.locator('.brand')).toContainText(config.brand.name);
  await expect(page.getByTestId('database-status')).toHaveText('Connected', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.getByTestId('database-status')).toHaveText('Connected', { timeout: 30_000 });
  await page.screenshot({ path: 'docs/internal/foundation-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('database-status')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'docs/internal/foundation-mobile.png', fullPage: true });
  expect((await request.get('/api/v1/not-implemented')).status()).toBe(404);
});
