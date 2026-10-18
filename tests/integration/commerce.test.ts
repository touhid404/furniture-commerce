import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { TOTP, Secret } from 'otpauth';
import { app } from '../../backend/src/app.js';
import { prisma } from '../../backend/src/db/client.js';
import { storeConfig } from '../../backend/src/config.js';
import { checkStorage } from '../../backend/src/services/storage.js';
import { assertFixtureEnvironment } from '../fixtures/environment.js';
assertFixtureEnvironment();
// Integration fixtures deliberately write records: refuse the production branch.
if (
  process.env.NEON_BRANCH === 'production' ||
  storeConfig.mode !== 'demo' ||
  process.env.DEMO_SEED !== 'true'
)
  throw new Error(
    'Integration tests require an isolated demo Neon branch. Production writes are prohibited.',
  );
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Server failed');
const base = `http://127.0.0.1:${address.port}/api/v1`;
class Client {
  cookie = '';
  csrf = '';
  async call(path: string, method = 'GET', data?: unknown, headers: Record<string, string> = {}) {
    const raw = data instanceof Buffer;
    const r = await fetch(base + path, {
      method,
      headers: {
        Cookie: this.cookie,
        ...(this.csrf ? { 'X-CSRF-Token': this.csrf } : {}),
        ...(data && !raw ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body:
        data === undefined
          ? undefined
          : raw
            ? new Uint8Array(data as Buffer)
            : JSON.stringify(data),
    });
    const cookie = r.headers.getSetCookie()[0];
    if (cookie) this.cookie = cookie.split(';')[0];
    const body = await r.json();
    if (body.data?.csrfToken) this.csrf = body.data.csrfToken;
    return { status: r.status, body };
  }
  async ok(path: string, method = 'GET', data?: unknown, headers: Record<string, string> = {}) {
    const r = await this.call(path, method, data, headers);
    assert.ok(
      r.status >= 200 && r.status < 300,
      `${method} ${path}: ${r.status} ${r.body.error?.message ?? ''}`,
    );
    return r.body.data;
  }
}
async function client() {
  const c = new Client();
  await c.ok('/auth/csrf');
  return c;
}
const suffix = randomUUID().slice(0, 8),
  market = storeConfig.markets.find((m) => m.id === storeConfig.defaultMarketId)!;
const delivery = {
  contactEmail: `api-${suffix}@example.invalid`,
  shippingAddress: {
    recipient: 'API Test Customer',
    line1: '12 Integration Street',
    line2: '',
    city: 'New York',
    region: 'NY',
    postalCode: '10001',
    country: market.country,
    phone: '5551234567',
  },
  shippingMethodId: 'standard',
};
let admin: Client,
  variant = '',
  productId = '';
const productInput = {
  categoryId: '',
  name: `Integration object ${suffix}`,
  slug: `integration-${suffix}`,
  description: 'A product used for isolated transaction verification.',
  materials: 'Wood',
  dimensions: '20 cm',
  care: 'Dry cloth',
  art: 'lamp',
  color: '#aabbcc',
  background: '#eeeeee',
  badge: '',
  imageUrl: '',
  featuredRank: 1000,
  status: 'PUBLISHED',
  sku: `TEST-${suffix}`,
  label: 'Natural',
  priceMinor: '10000',
  onHand: 8,
};
async function customer() {
  const c = await client();
  await c.ok('/auth/register', 'POST', {
    name: 'API Customer',
    email: `api-${randomUUID()}@example.invalid`,
    password: 'Integration-password-123!',
  });
  return c;
}
async function quote(c: Client, variantId = variant) {
  const me = await c.ok('/auth/me');
  if (!me.user)
    await c.ok('/auth/register', 'POST', {
      name: 'API Customer',
      email: `api-${randomUUID()}@example.invalid`,
      password: 'Integration-password-123!',
    });
  await c.ok('/cart/sync', 'POST', { marketId: market.id, items: [{ variantId, quantity: 1 }] });
  return c.ok('/checkout/quotes', 'POST', delivery);
}
async function order(c: Client) {
  const q = await quote(c);
  return c.ok(
    '/checkout/orders',
    'POST',
    { quoteId: q.id, paymentMethod: 'COD' },
    { 'Idempotency-Key': randomUUID() },
  );
}
try {
  await test(
    'real Neon commerce transaction and security acceptance',
    { timeout: 600_000 },
    async (t) => {
      admin = await client();
      await admin.ok('/auth/demo', 'POST');
      const cats = await admin.ok('/admin/categories');
      productInput.categoryId = cats[0].id;
      const p = await admin.ok('/admin/products', 'POST', productInput);
      productId = p.id;
      variant = p.variants[0].id;
      await t.test(
        'every admin route denies a guest; CSRF, Unicode token and role assignment are checked',
        async () => {
          const guest = await client();
          for (const path of [
            '/dashboard',
            '/orders',
            '/products',
            '/categories',
            '/inventory',
            '/returns',
            '/reviews',
            '/coupons',
            '/content',
            '/config',
            '/audit',
            '/notifications',
            '/media',
            '/exports/orders',
          ])
            assert.equal((await guest.call('/admin' + path)).status, 403);
          assert.equal((await guest.call('/admin/products', 'POST', productInput)).status, 403);
          assert.equal(
            (
              await guest.call(
                '/cart/items',
                'POST',
                { variantId: variant, quantity: 1 },
                { 'X-CSRF-Token': 'é'.repeat(64) },
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await guest.call(
                '/cart/items',
                'POST',
                { variantId: variant, quantity: 1 },
                { Origin: 'null' },
              )
            ).status,
            403,
          );
          assert.equal(
            (await guest.call('/cart/sync', 'POST', { marketId: market.id, items: [] })).status,
            401,
          );
          assert.equal((await guest.call('/checkout/quotes', 'POST', delivery)).status, 401);
          const result = await guest.ok('/auth/register', 'POST', {
            name: 'Security Test',
            email: `security-${suffix}@example.invalid`,
            password: 'Security-test-password!',
            role: 'ADMIN',
          });
          assert.equal(result.user.role, 'CUSTOMER');
          assert.equal((await guest.call('/admin/products', 'POST', productInput)).status, 403);
          const config = await guest.ok('/config');
          assert.equal(JSON.stringify(config).includes('AWS_SECRET'), false);
          assert.equal('maximumByCurrency' in config.checkout, false);
        },
      );
      await t.test(
        'account isolation, price tampering, quote expiry and idempotent order replay',
        async () => {
          const a = await customer(),
            b = await customer(),
            q = await quote(a),
            key = randomUUID();
          assert.equal(
            (
              await b.call(
                '/checkout/orders',
                'POST',
                { quoteId: q.id, paymentMethod: 'COD' },
                { 'Idempotency-Key': randomUUID() },
              )
            ).status,
            409,
          );
          assert.equal(
            (
              await a.call(
                '/checkout/orders',
                'POST',
                { quoteId: q.id, paymentMethod: 'COD', totalMinor: 1 },
                { 'Idempotency-Key': key },
              )
            ).status,
            422,
          );
          const responses = await Promise.all([
            a.call(
              '/checkout/orders',
              'POST',
              { quoteId: q.id, paymentMethod: 'COD' },
              { 'Idempotency-Key': key },
            ),
            a.call(
              '/checkout/orders',
              'POST',
              { quoteId: q.id, paymentMethod: 'COD' },
              { 'Idempotency-Key': key },
            ),
          ]);
          assert.deepEqual(
            responses.map((r) => r.status),
            [201, 201],
          );
          assert.equal(responses[0].body.data.id, responses[1].body.data.id);
          const o = responses[0].body.data;
          assert.equal(o.totalMinor, '10000');
          assert.equal((await b.call(`/orders/${o.id}`)).status, 404);
          assert.equal(
            (
              await a.call(
                '/checkout/orders',
                'POST',
                { quoteId: randomUUID(), paymentMethod: 'COD' },
                { 'Idempotency-Key': key },
              )
            ).status,
            409,
          );
          await a.ok(`/orders/${o.id}/cancellations`, 'POST');
          await a.ok(`/orders/${o.id}/cancellations`, 'POST');
          const exp = await quote(b);
          await prisma.checkoutQuote.update({
            where: { id: exp.id },
            data: { expiresAt: new Date(0) },
          });
          assert.equal(
            (
              await b.call(
                '/checkout/orders',
                'POST',
                { quoteId: exp.id, paymentMethod: 'COD' },
                { 'Idempotency-Key': randomUUID() },
              )
            ).status,
            409,
          );
        },
      );
      await t.test(
        'final stock, stale inventory version and cancellation versus shipping serialize safely',
        async () => {
          const inv = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant } });
          await admin.ok(`/admin/inventory/${inv.id}/adjustments`, 'POST', {
            delta: 1 - inv.onHand,
            version: inv.version,
            reason: 'Set final unit for race verification',
          });
          assert.equal(
            (
              await admin.call(`/admin/inventory/${inv.id}/adjustments`, 'POST', {
                delta: 1,
                version: inv.version,
                reason: 'Stale adjustment rejected',
              })
            ).status,
            409,
          );
          const a = await customer(),
            b = await customer(),
            qa = await quote(a),
            qb = await quote(b);
          const r = await Promise.all([
            a.call(
              '/checkout/orders',
              'POST',
              { quoteId: qa.id, paymentMethod: 'COD' },
              { 'Idempotency-Key': randomUUID() },
            ),
            b.call(
              '/checkout/orders',
              'POST',
              { quoteId: qb.id, paymentMethod: 'COD' },
              { 'Idempotency-Key': randomUUID() },
            ),
          ]);
          assert.deepEqual(r.map((v) => v.status).sort(), [201, 409]);
          const idx = r.findIndex((v) => v.status === 201),
            owner = idx === 0 ? a : b,
            o = r[idx].body.data;
          const race = await Promise.all([
            owner.call(`/orders/${o.id}/cancellations`, 'POST'),
            admin.call(`/admin/orders/${o.id}/shipments`, 'POST', {
              carrier: 'Test carrier',
              tracking: 'RACE-1',
            }),
          ]);
          assert.equal(race.filter((v) => v.status < 300).length, 1);
          const stock = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant } });
          assert.ok(stock.onHand >= stock.allocated && stock.allocated === 0 && stock.onHand >= 0);
          await admin.ok(`/admin/inventory/${stock.id}/adjustments`, 'POST', {
            delta: 10 - stock.onHand,
            version: stock.version,
            reason: 'Restore test units after race',
          });
        },
      );
      await t.test(
        'cash lifecycle, accounting by receipt date, return receipt and refund ceilings',
        async () => {
          const customer = await client(),
            o = await order(customer);
          assert.equal(
            (await admin.call(`/admin/orders/${o.id}/cod-collections`, 'POST')).status,
            409,
          );
          await admin.ok(`/admin/orders/${o.id}/shipments`, 'POST', {
            carrier: 'Integration carrier',
            tracking: 'INT-1',
          });
          assert.equal((await customer.call(`/orders/${o.id}/cancellations`, 'POST')).status, 409);
          await admin.ok(`/admin/orders/${o.id}/delivery`, 'POST');
          const before = await admin.ok(`/admin/dashboard?range=7d&currency=${market.currency}`);
          await prisma.order.update({
            where: { id: o.id },
            data: { createdAt: new Date(Date.now() - 100 * 86400000) },
          });
          await admin.ok(`/admin/orders/${o.id}/cod-collections`, 'POST');
          const after = await admin.ok(`/admin/dashboard?range=7d&currency=${market.currency}`);
          assert.equal(after.metrics.revenue - before.metrics.revenue, 10000);
          assert.equal(
            (await admin.call(`/admin/orders/${o.id}/cod-collections`, 'POST')).status,
            409,
          );
          const ret = await customer.ok(`/orders/${o.id}/returns`, 'POST', {
            reason: 'Return the verified test object',
            items: [{ orderItemId: o.items[0].id, quantity: 1 }],
          });
          assert.equal(
            (
              await customer.call(`/orders/${o.id}/returns`, 'POST', {
                reason: 'Duplicate test request',
                items: [{ orderItemId: o.items[0].id, quantity: 1 }],
              })
            ).status,
            409,
          );
          await admin.ok(`/admin/returns/${ret.id}/decisions`, 'POST', {
            status: 'APPROVED',
            resolution: 'Return approved for inspection',
          });
          await admin.ok(`/admin/returns/${ret.id}/receipts`, 'POST', {
            restock: true,
            resolution: 'Received and inspected',
          });
          assert.equal(
            (
              await admin.call(`/admin/returns/${ret.id}/receipts`, 'POST', {
                restock: true,
                resolution: 'Duplicate receipt',
              })
            ).status,
            409,
          );
          const key = randomUUID(),
            refund = {
              amountMinor: '4000',
              reason: 'Completed partial manual payout',
              reference: `PAYOUT-${suffix}`,
            };
          const first = await admin.ok(`/admin/orders/${o.id}/refunds`, 'POST', refund, {
            'Idempotency-Key': key,
          });
          const again = await admin.ok(`/admin/orders/${o.id}/refunds`, 'POST', refund, {
            'Idempotency-Key': key,
          });
          assert.equal(first.id, again.id);
          assert.equal(
            (
              await admin.call(
                `/admin/orders/${o.id}/refunds`,
                'POST',
                { ...refund, amountMinor: '6001' },
                { 'Idempotency-Key': randomUUID() },
              )
            ).status,
            422,
          );
          await admin.ok(
            `/admin/orders/${o.id}/refunds`,
            'POST',
            { ...refund, amountMinor: '6000', reference: 'FINAL-PAYOUT' },
            { 'Idempotency-Key': randomUUID() },
          );
          assert.equal((await customer.ok(`/orders/${o.id}`)).paymentStatus, 'REFUNDED');
        },
      );
      await t.test(
        'authenticator enrollment, password recovery and single-use order access links',
        async () => {
          const c = await client(),
            mail = `mfa-${suffix}@example.invalid`,
            password = 'A-long-test-password-123';
          await c.ok('/auth/register', 'POST', {
            name: 'MFA Test',
            email: mail,
            password,
          });
          const other = await client();
          await other.ok('/auth/login', 'POST', { email: mail, password });
          const setup = await c.ok('/account/mfa/setup', 'POST', { password });
          const code = new TOTP({ secret: Secret.fromBase32(setup.secret) }).generate();
          await c.ok('/account/mfa/enable', 'POST', { token: setup.token, code });
          assert.equal((await other.call('/account')).status, 401);
          const login = await client();
          assert.equal(
            (await login.call('/auth/login', 'POST', { email: mail, password })).status,
            401,
          );
          await login.ok('/auth/login', 'POST', {
            email: mail,
            password,
            code: new TOTP({ secret: Secret.fromBase32(setup.secret) }).generate(),
          });
          await c.ok('/auth/forgot-password', 'POST', { email: mail });
          const job = await prisma.outboxJob.findFirstOrThrow({
            where: { payload: { path: ['to'], equals: mail }, type: 'EMAIL' },
            orderBy: { createdAt: 'desc' },
          });
          const token = (job.payload as { text: string }).text.split('token=')[1];
          assert.ok(token);
          await c.ok('/auth/reset-password', 'POST', {
            token,
            password: 'Changed-long-password-123',
          });
          assert.equal(
            (
              await c.call('/auth/reset-password', 'POST', {
                token,
                password: 'Changed-again-password-123',
              })
            ).status,
            403,
          ); // reset invalidates its authenticated session
          const guest = await client(),
            o = await order(guest),
            access = await client();
          await access.ok('/auth/order-access/request', 'POST', {
            email: o.email,
            number: o.number,
          });
          const link = await prisma.outboxJob.findFirstOrThrow({
            where: { payload: { path: ['subject'], equals: 'Your order access link' } },
            orderBy: { createdAt: 'desc' },
          });
          const accessToken = (link.payload as { text: string }).text.split('token=')[1];
          const granted = await access.ok('/auth/order-access/consume', 'POST', {
            token: accessToken,
          });
          assert.equal(granted.orderId, o.id);
          assert.equal((await access.ok(`/orders/${o.id}`)).id, o.id);
          assert.equal(
            (await access.call('/auth/order-access/consume', 'POST', { token: accessToken }))
              .status,
            422,
          );
          await guest.ok(`/orders/${o.id}/cancellations`, 'POST');
        },
      );
      await t.test(
        'Neon upload bytes, stable asset URL, product link and media deletion protection',
        async () => {
          assert.equal((await checkStorage()).status, 'connected');
          const png = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAoElEQVRoge2SQQkAQRDD6l9PJPS/lk7EPcJAIQLS0PRxmugG3QD0it2FuEt0g24AesXuQtwlukE3AL1idyHuEt2gG4BesbsQd4lu0A1Ar9hdiLtEN+gGoFfsLsRdoht0A9ArdhfiLtENugHoFbsLcZfoBt0A9IrdhbhLdINuAHrF7kLcJbpBNwC9Ynch7hLdoBuAXrG7EHeJbtANQK/4hw+1HnIdBrYPpAAAAABJRU5ErkJggg==',
            'base64',
          );
          assert.equal(
            (
              await admin.call('/admin/media', 'POST', Buffer.from('<svg/>'), {
                'Content-Type': 'image/png',
              })
            ).status,
            422,
          );
          const asset = await admin.ok('/admin/media', 'POST', png, {
            'Content-Type': 'image/png',
            'X-File-Name': 'integration-pixel.png',
          });
          assert.ok(asset.objectKey.startsWith('uploads/'));
          assert.equal(asset.bucket, 'assets');
          const url = new URL(asset.url, base);
          const fetched = await fetch(url);
          assert.equal(fetched.status, 200);
          assert.deepEqual(Buffer.from(await fetched.arrayBuffer()), png);
          const p = await admin.ok(`/admin/products/${productId}`);
          await admin.ok(`/admin/products/${productId}`, 'PATCH', {
            ...productInput,
            onHand: p.variants[0].inventory.onHand,
            version: p.version,
            imageUrl: asset.url,
          });
          assert.equal((await admin.call(`/admin/media/${asset.id}`, 'DELETE')).status, 409);
          const updated = await admin.ok(`/admin/products/${productId}`);
          await admin.ok(`/admin/products/${productId}`, 'PATCH', {
            ...productInput,
            onHand: updated.variants[0].inventory.onHand,
            version: updated.version,
            imageUrl: '',
          });
          await admin.ok(`/admin/media/${asset.id}`, 'DELETE');
          assert.equal(await prisma.mediaAsset.count({ where: { id: asset.id } }), 0);
        },
      );
    },
  );
} finally {
  if (productId)
    await prisma.product.update({ where: { id: productId }, data: { status: 'ARCHIVED' } });
  server.close();
  await prisma.$disconnect();
}
