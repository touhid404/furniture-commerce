import { test, expect } from '@playwright/test';
test('reference storefront, catalog, bag persistence and responsive layouts', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Calm objects for slow living.' })).toBeVisible();
  await page.screenshot({ path: 'docs/internal/storefront-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Lighting', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'This week’s favourites' })).toBeVisible();
  await page.getByRole('button', { name: 'Add Linne Table Lamp to bag', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'added to your bag' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open bag, 1 items' })).toBeVisible();
  await page.getByRole('button', { name: 'Open bag, 1 items' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.screenshot({ path: 'docs/internal/catalog-desktop.png', fullPage: true });
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
  }
  await page.screenshot({ path: 'docs/internal/storefront-mobile.png', fullPage: true });
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('customer purchase, admin fulfillment, COD collection, review, return and manual refund', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(300_000);
  const context = await browser.newContext({ baseURL }),
    page = await context.newPage(),
    adminContext = await browser.newContext({ baseURL }),
    admin = await adminContext.newPage();
  const email = `browser-${Date.now()}@example.invalid`;
  const reviewText = `Beautifully made lamp. A lovely addition to my home. ${email}`;
  const returnReason = `Does not fit the planned space. ${email}`;
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Browser Customer');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Secure-test-password-123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Welcome home, Browser.' })).toBeVisible();
  await page.goto('/shop?category=lighting');
  await page.getByRole('button', { name: 'Add Linne Table Lamp to bag', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open bag, 1 items' })).toBeVisible();
  await page.goto('/checkout');
  await page.getByLabel('Full name', { exact: true }).fill('Browser Customer');
  await page.getByLabel('Phone number').fill('5551234567');
  await page.getByLabel('Street address', { exact: true }).fill('12 Test Street');
  await page.getByLabel('City', { exact: true }).fill('New York');
  await page.getByLabel('Postal code').fill('10001');
  await page.getByRole('button', { name: 'Review order', exact: true }).click();
  await expect(page.getByText('Delivery and prices confirmed.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Place cash on delivery order' }).click();
  await expect(page.getByRole('heading', { name: 'Consider it yours.' })).toBeVisible();
  const orderId = new URL(page.url()).pathname.split('/').at(-1)!;
  await page.screenshot({ path: 'docs/internal/order-confirmation.png', fullPage: true });
  await admin.goto('/sign-in');
  await admin.getByRole('button', { name: 'Continue as demo admin' }).click();
  await expect(
    admin.getByRole('heading', { name: /Good (morning|afternoon), Demo/ }),
  ).toBeVisible();
  await admin.screenshot({ path: 'docs/internal/admin-overview-desktop.png', fullPage: true });
  await admin.goto(`/admin/orders/${orderId}`);
  await admin.getByLabel('Carrier', { exact: true }).fill('Test carrier');
  await admin.getByLabel('Tracking reference', { exact: true }).fill('TRACK-BROWSER-1');
  await admin.getByRole('button', { name: 'Confirm dispatch', exact: true }).click();
  await expect(admin.getByRole('button', { name: 'Confirm delivery', exact: true })).toBeVisible();
  await admin.getByRole('button', { name: 'Confirm delivery', exact: true }).click();
  admin.on('dialog', (d) => d.accept());
  await expect(
    admin.getByRole('button', { name: 'Record cash collected', exact: true }),
  ).toBeVisible();
  await admin.getByRole('button', { name: 'Record cash collected', exact: true }).click();
  await expect(admin.getByRole('heading', { name: 'Record a manual COD refund' })).toBeVisible();
  await page.goto(`/orders/${orderId}`);
  await page.getByText('Leave a review', { exact: true }).click();
  await page.getByLabel('Your review', { exact: true }).fill(reviewText);
  await page.getByRole('button', { name: 'Submit review', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'awaiting moderation' })).toBeVisible();
  await page.getByLabel('Linne Table Lamp — quantity to return', { exact: true }).fill('1');
  await page.getByLabel('Reason for return', { exact: true }).fill(returnReason);
  await page.getByRole('button', { name: 'Request return', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Return request/ })).toBeVisible();
  await admin.goto('/admin/returns');
  const card = admin.locator('section').filter({ hasText: returnReason });
  await card
    .getByLabel('Resolution / instructions')
    .fill('Approved. Please return in the original packaging.');
  await card.getByRole('button', { name: 'Save decision' }).click();
  await expect(card.getByRole('button', { name: 'Confirm items received' })).toBeVisible();
  await card
    .getByLabel('Resolution / instructions')
    .fill('Inspected and received in original condition.');
  await card.getByRole('button', { name: 'Confirm items received' }).click();
  await expect(card.getByText('RECEIVED', { exact: true })).toBeVisible();
  await admin.goto(`/admin/orders/${orderId}`);
  await admin.getByLabel('Refund amount (minor units)').fill('18900');
  await admin.getByLabel('Payout reference').fill('PAYOUT-BROWSER-1');
  await admin
    .getByLabel('Reason', { exact: true })
    .fill('Customer received the full manual refund.');
  await admin.getByRole('button', { name: 'Record completed refund' }).click();
  await expect(admin.getByText('REFUNDED', { exact: true })).toBeVisible();
  await admin.goto('/admin/reviews');
  const review = admin.locator('section').filter({ hasText: reviewText });
  await review.getByRole('button', { name: 'Publish review' }).click();
  await expect(review.getByText('Published', { exact: true })).toBeVisible();
  for (const name of [
    'Products',
    'Categories',
    'Inventory',
    'Storefront',
    'Promotions',
    'Media',
    'Notifications',
    'Audit trail',
    'Settings',
  ]) {
    await admin
      .getByRole('navigation', { name: 'Admin navigation' })
      .getByRole('link', { name, exact: true })
      .click();
    await expect(admin.locator('h1')).toBeVisible();
    await expect(admin.getByRole('alert')).toHaveCount(0);
  }
  await admin.setViewportSize({ width: 390, height: 844 });
  await admin.goto('/admin');
  await expect(
    admin.getByRole('heading', { name: /Good (morning|afternoon), Demo/ }),
  ).toBeVisible();
  expect(
    await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await admin.screenshot({ path: 'docs/internal/admin-mobile.png', fullPage: true });
  await context.close();
  await adminContext.close();
});

test('admin creates a category, uploads a product image to Neon and publishes a page', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const suffix = Date.now().toString(36),
    name = `Studio test ${suffix}`,
    slug = `studio-test-${suffix}`;
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Continue as demo admin' }).click();
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon), Demo/ })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Admin navigation' })
    .getByRole('link', { name: 'Categories', exact: true })
    .click();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Slug', { exact: true }).fill(slug);
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Admin navigation' })
    .getByRole('link', { name: 'Products', exact: true })
    .click();
  await page.getByRole('link', { name: 'Add product' }).click();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('URL slug').fill(slug);
  await page
    .getByLabel('Description', { exact: true })
    .fill('A considered object created through the complete admin workflow.');
  await page.getByLabel('Category', { exact: true }).selectOption({ label: name });
  await page.getByLabel('Status', { exact: true }).selectOption('PUBLISHED');
  await page.getByLabel('SKU', { exact: true }).fill(`BROWSER-${suffix}`);
  await page.getByLabel(/Price in minor units/).fill('5000');
  await page.getByLabel('Units on hand').fill('4');
  await page.getByLabel('Upload product image to Neon', { exact: true }).setInputFiles({
    name: 'browser-test.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jgdEAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(
    page.getByLabel('Image URL (HTTPS or uploaded /media/ path)', { exact: true }),
  ).toHaveValue(/^\/media\//);
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.goto(`/products/${slug}`);
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  const photo = page.getByRole('img', { name, exact: true });
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await page.goto('/admin/content');
  await page.getByLabel('Page key', { exact: true }).fill(slug);
  await page.getByLabel('Title', { exact: true }).fill(name);
  await page
    .getByLabel('Body (plain text)', { exact: true })
    .fill('A published page created through the admin content editor.');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: name });
  await row.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(row.getByText('Published', { exact: true })).toBeVisible();
  await page.goto(`/policies/${slug}`);
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(
    page.getByText('A published page created through the admin content editor.', { exact: true }),
  ).toBeVisible();
});
