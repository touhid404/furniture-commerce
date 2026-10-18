import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTotals,
  csvCell,
  ownsCart,
  retryableTransaction,
} from '../backend/src/services/calculations.js';
test('discounts and exclusive tax use exact integer amounts', () => {
  assert.deepEqual(calculateTotals(19999n, 10, 500n, 750, false), {
    subtotalMinor: 19999n,
    discountMinor: 1999n,
    shippingMinor: 500n,
    taxMinor: 1350n,
    totalMinor: 19850n,
  });
});
test('included tax is disclosed without adding it twice', () => {
  const t = calculateTotals(12000n, 0, 0n, 2000, true);
  assert.equal(t.taxMinor, 2000n);
  assert.equal(t.totalMinor, 12000n);
});
test('CSV formula prefixes are escaped', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
});

test('guest checkout rejects another guest cart even when both users are null', () => {
  assert.equal(
    ownsCart({ userId: null, sessionId: 'owner' }, { userId: null, id: 'attacker' }),
    false,
  );
  assert.equal(ownsCart({ userId: null, sessionId: 'owner' }, { userId: null, id: 'owner' }), true);
});
test('signed-in checkout is scoped to the account that owns the cart', () => {
  assert.equal(
    ownsCart({ userId: 'customer', sessionId: null }, { userId: 'other', id: 'session' }),
    false,
  );
  assert.equal(
    ownsCart({ userId: 'customer', sessionId: null }, { userId: 'customer', id: 'new-session' }),
    true,
  );
});

test('raw PostgreSQL serialization and deadlock errors are retried with ORM conflicts', () => {
  assert.equal(retryableTransaction({ code: 'P2010', meta: { code: '40001' } }), true);
  assert.equal(retryableTransaction({ code: 'P2010', meta: { code: '40P01' } }), true);
  assert.equal(retryableTransaction({ code: 'P2010', meta: { code: '23514' } }), false);
});
test('taxable shipping follows the configured tax rule', () => {
  assert.equal(calculateTotals(10000n, 0, 500n, 1000, false, true).taxMinor, 1050n);
});

test('Prisma driver adapter exposes PostgreSQL conflicts inside its nested cause', () => {
  assert.equal(
    retryableTransaction({
      code: 'P2010',
      meta: { driverAdapterError: { cause: { originalCode: '40001', kind: 'postgres' } } },
    }),
    true,
  );
});

import { allowedRequestOrigin } from '../backend/src/services/security.js';
test('Vite origin is allowed only in demo/development and unrelated origins stay blocked', () => {
  assert.equal(
    allowedRequestOrigin(
      'http://localhost:5173',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3001',
      true,
    ),
    true,
  );
  assert.equal(
    allowedRequestOrigin(
      'http://localhost:5173',
      'https://shop.example',
      'http://127.0.0.1:3001',
      false,
    ),
    false,
  );
  assert.equal(
    allowedRequestOrigin(
      'https://shop.example',
      'https://shop.example',
      'http://127.0.0.1:3001',
      false,
    ),
    true,
  );
  assert.equal(
    allowedRequestOrigin(
      'https://evil.example',
      'https://shop.example',
      'http://127.0.0.1:3001',
      true,
    ),
    false,
  );
  assert.equal(
    allowedRequestOrigin('null', 'https://shop.example', 'http://127.0.0.1:3001', true),
    false,
  );
});

import { assertResetAllowed } from '../scripts/reset-guard.js';
import { processImage } from '../backend/src/services/image-processing.js';
import sharp from 'sharp';
test('destructive reset requires project, branch, endpoint and separate production approval', () => {
  const host = 'ep-quiet-frog-b5tcammn.c-7.us-east-2.aws.neon.tech';
  const env = {
    NEON_BRANCH: 'production',
    DATABASE_URL: `postgresql://test@${host.replace('.c-', '-pooler.c-')}/test`,
    DATABASE_URL_UNPOOLED: `postgresql://test@${host}/test`,
  };
  const args = [
    '--confirm-project=quiet-boat-96833475',
    '--confirm-branch=production',
    `--confirm-host=${host}`,
  ];
  assert.throws(() => assertResetAllowed(args, env, 'demo'));
  assert.doesNotThrow(() => assertResetAllowed([...args, '--allow-production'], env, 'demo'));
  assert.throws(() =>
    assertResetAllowed([...args, '--allow-production'], { ...env, NODE_ENV: 'production' }, 'demo'),
  );
  assert.throws(() =>
    assertResetAllowed(
      [...args, '--allow-production'],
      { ...env, NEON_BRANCH: 'dev-commerce-platform' },
      'demo',
    ),
  );
  assert.throws(() => assertResetAllowed([...args, '--allow-production'], env, 'production'));
});
test('image decoder rejects spoofed contents and creates a bounded card image', async () => {
  await assert.rejects(processImage(Buffer.from('<svg onload=alert(1) />'), 'image/jpeg'));
  await assert.rejects(processImage(Buffer.alloc(2 * 1024 * 1024 + 1), 'image/png'));
  const image = await sharp({
    create: { width: 1600, height: 900, channels: 3, background: '#abc' },
  })
    .jpeg()
    .toBuffer();
  await assert.rejects(processImage(image, 'image/png'));
  const result = await processImage(image, 'image/jpeg');
  const meta = await sharp(result.card).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 480);
  assert.equal(meta.height, 270);
  assert.ok(result.card.length < image.length);
});

import {
  addItem,
  changeQuantity,
  emptyCart,
  parseCart,
  subtractPurchased,
} from '../frontend/src/lib/local-cart.js';
import type { Product, Variant } from '../frontend/src/lib/types.js';
test('local cart combines variants, computes exact totals and removes only purchased quantities', () => {
  const variant = {
    id: '00000000-0000-4000-8000-000000000001',
    label: 'Oak',
    available: 10,
    priceMinor: '19999',
  } as Variant;
  const product = {
    name: 'Chair',
    slug: 'chair',
    art: 'chair',
    color: '#aabbcc',
    background: '#eeeeee',
    imageUrl: '',
    variants: [variant],
  } as Product;
  let cart = addItem(emptyCart('test', 'USD'), product, variant, 1, 10);
  cart = addItem(cart, product, variant, 2, 10);
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].quantity, 3);
  assert.equal(cart.subtotalMinor, '59997');
  const restored = parseCart(JSON.stringify(cart), emptyCart('test', 'USD'));
  assert.equal(restored.subtotalMinor, '59997');
  assert.throws(() => addItem(cart, product, variant, 8, 10));
  assert.throws(() => changeQuantity(cart, variant.id, 1.5, 10));
  assert.equal(
    subtractPurchased(cart, [{ variantId: variant.id, quantity: 2 }]).items[0].quantity,
    1,
  );
  assert.equal(changeQuantity(cart, variant.id, 0, 10).items.length, 0);
  const bad = { ...cart, subtotalMinor: '1', items: [...cart.items, ...cart.items] };
  assert.equal(parseCart(JSON.stringify(bad), emptyCart('test', 'USD')).subtotalMinor, '59997');
  assert.equal(parseCart('{', emptyCart('test', 'USD')).items.length, 0);
});

import { couponProblem } from '../backend/src/services/calculations.js';
test('promotion rules cover minimum spend, currency, expiry, disabled and exhausted codes', () => {
  const coupon = {
    active: true,
    currency: 'USD',
    used: 0,
    maxUses: 1,
    minimumMinor: 10000n,
    expiresAt: null,
  };
  assert.equal(couponProblem(coupon, 'USD', 10000n), null);
  assert.equal(couponProblem(coupon, 'USD', 9999n), 'minimum');
  assert.equal(couponProblem(coupon, 'EUR', 10000n), 'currency');
  assert.equal(couponProblem({ ...coupon, active: false }, 'USD', 10000n), 'unavailable');
  assert.equal(couponProblem({ ...coupon, used: 1 }, 'USD', 10000n), 'exhausted');
  assert.equal(couponProblem({ ...coupon, expiresAt: new Date(0) }, 'USD', 10000n), 'expired');
  assert.equal(couponProblem(null, 'USD', 10000n), 'unavailable');
});

test('admin middleware fails closed for customer, missing, expired and disabled sessions', async () => {
  const { requireAdmin } = await import('../backend/src/middleware/authorization.js');
  const make = (role = 'ADMIN') => ({
    expiresAt: new Date(Date.now() + 60000),
    user: { role, disabled: false, requiresPasswordChange: false },
  });
  const check = (session: unknown) => {
    let allowed = false;
    requireAdmin({ shopSession: session } as never, {} as never, () => {
      allowed = true;
    });
    return allowed;
  };
  for (const session of [
    undefined,
    make('CUSTOMER'),
    { ...make(), expiresAt: new Date(0) },
    { ...make(), user: { ...make().user, disabled: true } },
  ])
    assert.throws(() => check(session), { code: 'FORBIDDEN' });
  assert.equal(check(make()), true);
});

test('API client handles empty, non-JSON and 204 responses without parser errors', async () => {
  const { decodeApiResponse } = await import('../frontend/src/lib/http.js');
  await assert.rejects(() => decodeApiResponse(new Response('', { status: 502 })), {
    code: 'INVALID_RESPONSE',
    status: 502,
  });
  await assert.rejects(
    () => decodeApiResponse(new Response('<html>Unavailable</html>', { status: 503 }), true),
    /Refresh to check its status/,
  );
  await assert.rejects(() => decodeApiResponse(new Response('null', { status: 200 })), {
    code: 'INVALID_RESPONSE',
  });
  assert.deepEqual(await decodeApiResponse(new Response(null, { status: 204 })), { data: null });
  assert.deepEqual(
    await decodeApiResponse(new Response('{"data":{"onHand":7}}', { status: 200 })),
    { data: { onHand: 7 } },
  );
});
