import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('storefront, sign-in and bag dialog meet automated WCAG A/AA checks', async ({ page }) => {
  for (const path of ['/', '/sign-in', '/shop?category=lighting']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
  }
  await page.getByRole('button', { name: 'Open bag, 0 items' }).click();
  const result = await new AxeBuilder({ page })
    .include('dialog')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(result.violations).toEqual([]);
});
