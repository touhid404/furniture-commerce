import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { app } from '../../backend/src/app.js';
import { prisma } from '../../backend/src/db/client.js';
import { storeConfig } from '../../backend/src/config.js';
import { assertFixtureEnvironment } from '../fixtures/environment.js';
assertFixtureEnvironment();
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string') throw Error('Server unavailable');
const base = `http://127.0.0.1:${address.port}/api/v1`;
function client() {
  let cookie = '',
    csrf = '';
  return async (
    path: string,
    method = 'GET',
    input?: unknown,
    extra: Record<string, string> = {},
  ) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        Cookie: cookie,
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...(input ? { 'Content-Type': 'application/json' } : {}),
        ...extra,
      },
      body: input ? JSON.stringify(input) : undefined,
    });
    const setCookie = response.headers.getSetCookie()[0];
    if (setCookie) cookie = setCookie.split(';')[0];
    const body = await response.json();
    if (body.data?.csrfToken) csrf = body.data.csrfToken;
    return { status: response.status, ...body };
  };
}
try {
  await test(
    'promotion preview, authoritative checkout discount, redemption and private tracking',
    { timeout: 240000 },
    async () => {
      const request = client(),
        other = client();
      await request('/auth/csrf');
      await other('/auth/csrf');
      const market = storeConfig.markets.find((m) => m.id === storeConfig.defaultMarketId)!;
      const category = await prisma.category.findFirstOrThrow();
      const product = await prisma.product.create({
          data: {
            name: 'Promotion fixture',
            slug: `promo-fixture-${randomUUID()}`,
            description: 'Isolated promotion fixture',
            status: 'PUBLISHED',
            categoryId: category.id,
            variants: {
              create: {
                sku: `PROMO-${randomUUID()}`,
                label: 'Default',
                prices: {
                  create: { marketId: market.id, currency: market.currency, amountMinor: 18900n },
                },
                inventory: { create: { onHand: 10 } },
              },
            },
          },
          include: { variants: true },
        }),
        variant = product.variants[0];
      const code = `API-${randomUUID().slice(0, 8).toUpperCase()}`;
      const coupon = await prisma.coupon.create({
        data: { code, percent: 10, minimumMinor: 0n, maxUses: 1, currency: market.currency },
      });
      const input = {
        marketId: market.id,
        code: code.toLowerCase(),
        items: [{ variantId: variant.id, quantity: 1 }],
      };
      const before = await prisma.cart.count();
      const preview = await request('/promotions/preview', 'POST', input);
      assert.equal(preview.status, 200);
      assert.equal(preview.data.discountMinor, '1890');
      assert.equal(preview.data.totalMinor, '17010');
      assert.equal(await prisma.cart.count(), before);
      assert.equal((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).used, 0);
      assert.equal(
        (await request('/promotions/preview', 'POST', { ...input, subtotalMinor: '1' })).status,
        422,
      );
      assert.equal(
        (await request('/promotions/preview', 'POST', { ...input, code: 'DOES-NOT-EXIST' })).status,
        422,
      );
      for (const data of [
        { minimumMinor: 20000n },
        { minimumMinor: 0n, expiresAt: new Date(0) },
        { expiresAt: null, active: false },
        { active: true, currency: 'EUR' },
        { currency: market.currency, used: 1 },
      ]) {
        await prisma.coupon.update({ where: { id: coupon.id }, data });
        assert.equal((await request('/promotions/preview', 'POST', input)).status, 422);
      }
      await prisma.coupon.update({ where: { id: coupon.id }, data: { used: 0 } });
      const email = `promotion-${randomUUID()}@example.invalid`;
      assert.equal(
        (
          await request('/auth/register', 'POST', {
            email,
            password: 'Promotion-test-password!',
            name: 'Promotion Customer',
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await request('/cart/sync', 'POST', {
            marketId: market.id,
            couponCode: code,
            items: input.items,
          })
        ).status,
        200,
      );
      const quote = await request('/checkout/quotes', 'POST', {
        contactEmail: email,
        shippingAddress: {
          recipient: 'Promotion Customer',
          line1: '12 Test Street',
          line2: '',
          city: 'New York',
          region: 'NY',
          postalCode: '10001',
          country: market.country,
          phone: '5551234567',
        },
        shippingMethodId: storeConfig.shipping.rates.find((r) => r.marketId === market.id)!.id,
      });
      assert.equal(quote.status, 201);
      assert.equal(quote.data.totals.discountMinor, '1890');
      const key = randomUUID(),
        order = await request(
          '/checkout/orders',
          'POST',
          { quoteId: quote.data.id, paymentMethod: 'COD' },
          { 'Idempotency-Key': key },
        );
      assert.equal(order.status, 201);
      assert.equal(order.data.discountMinor, '1890');
      const replay = await request(
        '/checkout/orders',
        'POST',
        { quoteId: quote.data.id, paymentMethod: 'COD' },
        { 'Idempotency-Key': key },
      );
      assert.equal(replay.data.id, order.data.id);
      assert.equal((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).used, 1);
      const found = await request(`/orders/lookup?number=${order.data.number.toLowerCase()}`);
      assert.equal(found.status, 200);
      assert.equal(found.data.orderId, order.data.id);
      assert.equal((await other(`/orders/lookup?number=${order.data.number}`)).status, 401);
      await other('/auth/register', 'POST', {
        email: `other-${randomUUID()}@example.invalid`,
        name: 'Other Customer',
        password: 'Promotion-other-password!',
      });
      assert.equal((await other(`/orders/lookup?number=${order.data.number}`)).status, 404);
      assert.equal((await request('/promotions/preview', 'POST', input)).status, 422);
      console.log(
        'PASS valid/invalid/minimum/expired/inactive/currency/exhausted/tampered promo; preview does not redeem; checkout redeems once; tracking is account-scoped.',
      );
    },
  );
} finally {
  server.close();
  await prisma.$disconnect();
}
