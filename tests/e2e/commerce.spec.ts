import { test, expect, type Page } from '@playwright/test';
async function approveAdminActions(page: Page) {
  await page.addLocatorHandler(page.getByRole('alertdialog'), async (dialog) => {
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  });
}
test.beforeEach(async ({ page }) => {
  await approveAdminActions(page);
});
test.beforeEach(async ({ request }, info) => {
  if (info.title.startsWith('reference storefront') || info.title.startsWith('guest cart')) return;
  const config = await (await request.get('/api/v1/config')).json();
  expect(
    config.data.capabilities.testWritesAllowed,
    'Fixture tests must never write to the production database',
  ).toBe(true);
});
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
  await page.goto('/products/man-pendant');
  await expect(page.locator('.product-specifications dt')).toHaveText([
    'Materials',
    'Dimensions',
    'Care',
  ]);
  for (const value of await page.locator('.product-specifications dd').all())
    await expect(value).toBeVisible();
  await expect(page.locator('.detail-copy summary')).toHaveCount(0);
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
  await approveAdminActions(admin);
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
  await expect(page.getByText('Delivery and prices confirmed.', { exact: false })).toBeVisible({
    timeout: 60000,
  });
  await page.getByRole('button', { name: 'Confirm order', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Consider it yours.' })).toBeVisible({
    timeout: 60000,
  });
  const orderId = new URL(page.url()).pathname.split('/').at(-1)!;
  const order = await (await page.request.get(`/api/v1/orders/${orderId}`)).json();
  await page.goto('/order-access');
  await page.getByLabel('Order number', { exact: true }).fill(order.data.number.toLowerCase());
  await page.getByRole('button', { name: 'Track order', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: `Order ${order.data.number}`, exact: true }),
  ).toBeVisible();
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
  await admin.getByLabel('Search returns', { exact: true }).fill(email);
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
  await admin.getByLabel('Search reviews', { exact: true }).fill(email);
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
  await page.getByLabel('Search categories', { exact: true }).fill(name);
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
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption({ label: name });
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('PUBLISHED');
  await page.getByLabel('SKU', { exact: true }).fill(`BROWSER-${suffix}`);
  await page.getByLabel(/Price in minor units/).fill('5000');
  await page.getByLabel('Units on hand').fill('4');
  await page.getByLabel('Upload product image to Neon', { exact: true }).setInputFiles({
    name: 'browser-test.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAoElEQVRoge2SQQkAQRDD6l9PJPS/lk7EPcJAIQLS0PRxmugG3QD0it2FuEt0g24AesXuQtwlukE3AL1idyHuEt2gG4BesbsQd4lu0A1Ar9hdiLtEN+gGoFfsLsRdoht0A9ArdhfiLtENugHoFbsLcZfoBt0A9IrdhbhLdINuAHrF7kLcJbpBNwC9Ynch7hLdoBuAXrG7EHeJbtANQK/4hw+1HnIdBrYPpAAAAABJRU5ErkJggg==',
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
  await page.goto('/admin/inventory');
  await page.getByLabel('Search inventory', { exact: true }).fill(name);
  const inventoryRow = page.getByRole('row').filter({ hasText: `BROWSER-${suffix}` });
  await expect(inventoryRow.getByRole('cell').nth(1)).toHaveText('4');
  await page.getByLabel(`Quantity adjustment for BROWSER-${suffix}`, { exact: true }).fill('3');
  await page
    .getByLabel(`Adjustment reason for BROWSER-${suffix}`, { exact: true })
    .fill('Restocked three units');
  await inventoryRow.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(inventoryRow.getByRole('cell').nth(1)).toHaveText('7');
  await expect(inventoryRow.getByRole('cell').nth(3)).toHaveText('7');
  await page.reload();
  await expect(inventoryRow.getByRole('cell').nth(1)).toHaveText('7');
  await page.goto('/admin/content');
  await page.getByLabel('Page key', { exact: true }).fill(slug);
  await page.getByLabel('Title', { exact: true }).fill(name);
  await page
    .getByLabel('Body (plain text)', { exact: true })
    .fill('A published page created through the admin content editor.');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.getByLabel('Search content', { exact: true }).fill(name);
  const row = page.getByRole('row').filter({ hasText: name });
  await row.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(row.getByText('Published', { exact: true })).toBeVisible();
  await page.goto(`/policies/${slug}`);
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(
    page.getByText('A published page created through the admin content editor.', { exact: true }),
  ).toBeVisible();
});

test('guest cart is instant, persistent, animated and independent of cart APIs', async ({
  page,
}) => {
  await page.route('**/api/v1/products?**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue();
  });
  await page.goto('/shop?category=lighting');
  await expect(page.getByRole('status', { name: 'Loading content' })).toBeVisible();
  const add = page.getByRole('button', { name: 'Add Linne Table Lamp to bag', exact: true });
  await expect(add).toBeVisible();
  let requests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/cart')) requests++;
  });
  await page.route('**/api/v1/cart**', (route) => route.abort());
  await add.click();
  await expect(page.getByRole('button', { name: 'Open bag, 1 items' })).toBeVisible({
    timeout: 500,
  });
  await expect(page.locator('.flying-product')).toHaveCount(1);
  const duration = await page
    .locator('.flying-product')
    .evaluate((element) => element.getAnimations()[0].effect!.getTiming().duration);
  expect(duration).toBe(1050);
  await add.click();
  await expect(page.getByRole('button', { name: 'Open bag, 2 items' })).toBeVisible();
  await expect(page.locator('.flying-product')).toHaveCount(0, { timeout: 2000 });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open bag, 2 items' })).toBeVisible();
  await page.getByRole('button', { name: 'Open bag, 2 items' }).click();
  await page.getByRole('button', { name: 'Decrease Linne Table Lamp', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open bag, 1 items' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await add.click();
  await expect(page.locator('.flying-product')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open bag, 2 items' })).toBeVisible();
  expect(requests).toBe(0);
  await page.goto('/checkout');
  await expect(page).toHaveURL(/sign-in\?next=\/checkout/);
  await expect(page.getByRole('button', { name: 'Open bag, 2 items' })).toBeVisible();
});

test('promotion code displays savings immediately and recalculates quantities', async ({
  page,
}) => {
  await page.goto('/shop?category=lighting');
  await page.getByRole('button', { name: 'Add Linne Table Lamp to bag', exact: true }).click();
  await page.goto('/bag');
  await page.getByLabel('Promotion code', { exact: true }).fill('INVALID-NOT-A-CODE');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('not available');
  await expect(page.locator('.promotion-savings')).toHaveCount(0);
  await page.getByLabel('Promotion code', { exact: true }).fill('welcome10');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('aside .promotion-savings')).toContainText('WELCOME10');
  await expect(page.locator('aside .bag-totals del')).toContainText('$189');
  await expect(page.locator('aside .promotion-savings')).toContainText('18.9');
  await expect(page.locator('aside .bag-totals .total')).toContainText('170.1');
  await page.getByRole('button', { name: 'Increase Linne Table Lamp', exact: true }).click();
  await expect(page.locator('aside .promotion-savings')).toContainText('37.8');
  await expect(page.locator('aside .bag-totals .total')).toContainText('340.2');
  await page.reload();
  await expect(page.locator('aside .bag-totals .total')).toContainText('340.2');
  await page.getByRole('button', { name: 'Remove WELCOME10', exact: true }).click();
  await expect(page.locator('aside .promotion-savings')).toHaveCount(0);
  await expect(page.locator('aside .bag-totals')).toContainText('$378');
});

test('admin sign-in redirects, protected pages and cancellable settings/logout', async ({
  page,
  browser,
  baseURL,
}) => {
  const customerContext = await browser.newContext({ baseURL }),
    customer = await customerContext.newPage();
  await customer.goto('/sign-in');
  await customer.getByRole('button', { name: 'Create account', exact: true }).click();
  await customer.getByLabel('Your name', { exact: true }).fill('Normal Customer');
  await customer.getByLabel('Email', { exact: true }).fill(`route-${Date.now()}@example.invalid`);
  await customer.getByLabel('Password', { exact: true }).fill('Customer-password-123!');
  await customer.getByRole('button', { name: 'Create account', exact: true }).last().click();
  await expect(customer).toHaveURL(/\/account$/);
  for (const route of ['admin', 'admin/products', 'admin/inventory', 'admin/settings']) {
    await customer.goto('/' + route);
    await expect(customer).toHaveURL(/\/account$/);
    await expect(customer.getByRole('navigation', { name: 'Admin navigation' })).toHaveCount(0);
  }
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Continue as demo admin' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/account');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('.admin-brand .demo-label')).toHaveCount(0);
  await page.goto('/admin/settings');
  await expect(page.getByLabel('Store name', { exact: true })).toHaveValue('KVIST');
  await expect(page.getByText('mode', { exact: true })).toHaveCount(0);
  await page.removeLocatorHandler(page.getByRole('alertdialog'));
  let saves = 0;
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().endsWith('/admin/config')) saves++;
  });
  await page.getByLabel('Store name', { exact: true }).fill('Cancelled name');
  await page.getByRole('button', { name: 'Save store settings', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(saves).toBe(0);
  await page.reload();
  await expect(page.getByLabel('Store name', { exact: true })).toHaveValue('KVIST');
  const tagline = page.getByLabel('Tagline', { exact: true }),
    original = await tagline.inputValue();
  await tagline.fill('Considered furniture, saved from admin');
  await page.getByRole('button', { name: 'Save store settings', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Store settings saved.' })).toBeVisible();
  await page.reload();
  await expect(tagline).toHaveValue('Considered furniture, saved from admin');
  await tagline.fill(original);
  await page.getByRole('button', { name: 'Save store settings', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Store settings saved.' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Admin navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page).toHaveURL(/sign-in/);
  await customerContext.close();
});

test('an empty proxy response recovers on a safe catalog read', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/v1/products?**', async (route) => {
    attempts++;
    if (attempts === 1) await route.fulfill({ status: 502, body: '' });
    else await route.continue();
  });
  await page.goto('/shop?category=lighting');
  await expect(
    page.getByRole('button', { name: 'Add Linne Table Lamp to bag', exact: true }),
  ).toBeVisible();
  expect(attempts).toBe(2);
  await expect(page.getByText(/Unexpected end of JSON|Failed to execute 'json'/)).toHaveCount(0);
});
