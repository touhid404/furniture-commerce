import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { storeConfig } from '../config.js';
import { ensureSession, requireUser } from './auth.js';
import {
  addressSchema,
  atomic,
  canonical,
  digest,
  email,
  event,
  fail,
  id,
  json,
  lockOrder,
  moveStock,
  type Tx,
} from '../services/core.js';
import type { Cart, Prisma, Order } from '../generated/prisma/client.js';
import { calculateTotals, ownsCart } from '../services/calculations.js';
export const commerce = Router();
async function cartFor(req: Request, res: Response) {
  const s = await ensureSession(req, res);
  const market = storeConfig.markets.find((m) => m.id === storeConfig.defaultMarketId)!;
  const where = s.userId ? { userId: s.userId } : { sessionId: s.id };
  return prisma.cart.upsert({
    where,
    create: { ...where, marketId: market.id, currency: market.currency },
    update: {},
  });
}
export async function readCart(cart: Cart, db: Tx = prisma) {
  const items = await db.cartItem.findMany({
    where: { cartId: cart.id },
    include: {
      variant: {
        include: {
          product: { include: { category: true } },
          prices: {
            where: { marketId: cart.marketId, currency: cart.currency },
          },
          inventory: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  });
  return {
    ...cart,
    items: items.map((i) => ({
      id: i.id,
      variantId: i.variantId,
      quantity: i.quantity,
      name: i.variant.product.name,
      slug: i.variant.product.slug,
      art: i.variant.product.art,
      color: i.variant.product.color,
      background: i.variant.product.background,
      imageUrl: i.variant.product.imageUrl,
      label: i.variant.label,
      available: (i.variant.inventory?.onHand ?? 0) - (i.variant.inventory?.allocated ?? 0),
      unitPriceMinor: i.variant.prices[0]?.amountMinor ?? 0n,
      purchasable:
        i.variant.active &&
        i.variant.product.status === 'PUBLISHED' &&
        i.variant.product.category.active &&
        i.variant.prices.length > 0,
      category: i.variant.product.category.name,
      sku: i.variant.sku,
    })),
    subtotalMinor: items.reduce(
      (s, i) => s + (i.variant.prices[0]?.amountMinor ?? 0n) * BigInt(i.quantity),
      0n,
    ),
  };
}
commerce.get('/cart', async (req, res) =>
  res.json({ data: await readCart(await cartFor(req, res)) }),
);
commerce.post('/cart/items', async (req, res) => {
  const d = z
    .object({
      variantId: id,
      quantity: z.number().int().min(1).max(storeConfig.checkout.maxQuantityPerSku),
    })
    .strict()
    .parse(req.body);
  const cart = await cartFor(req, res);
  await atomic(async (tx) => {
    const v = await tx.productVariant.findUnique({
      where: { id: d.variantId },
      include: {
        product: true,
        inventory: true,
        prices: { where: { marketId: cart.marketId, currency: cart.currency } },
      },
    });
    if (!v || !v.active || v.product.status !== 'PUBLISHED' || !v.prices.length)
      fail(422, 'PRODUCT_UNAVAILABLE', 'This item is unavailable.');
    const old = await tx.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId: v.id } },
    });
    const quantity = (old?.quantity ?? 0) + d.quantity;
    if (
      quantity > storeConfig.checkout.maxQuantityPerSku ||
      quantity > (v.inventory?.onHand ?? 0) - (v.inventory?.allocated ?? 0)
    )
      fail(409, 'STOCK_CHANGED', 'That quantity is unavailable.');
    await tx.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId: v.id } },
      create: { cartId: cart.id, variantId: v.id, quantity },
      update: { quantity },
    });
    await tx.cart.update({
      where: { id: cart.id },
      data: { version: { increment: 1 } },
    });
  });
  res.json({
    data: await readCart((await prisma.cart.findUnique({ where: { id: cart.id } }))!),
  });
});
commerce.patch('/cart/items/:id', async (req, res) => {
  const d = z
    .object({
      quantity: z.number().int().min(1).max(storeConfig.checkout.maxQuantityPerSku),
    })
    .parse(req.body);
  const cart = await cartFor(req, res);
  const item = await prisma.cartItem.findFirst({
    where: { id: id.parse(req.params.id), cartId: cart.id },
    include: { variant: { include: { inventory: true } } },
  });
  if (!item) fail(404, 'NOT_FOUND', 'Bag item was not found.');
  if (d.quantity > (item.variant.inventory?.onHand ?? 0) - (item.variant.inventory?.allocated ?? 0))
    fail(409, 'STOCK_CHANGED', 'That quantity is unavailable.');
  await prisma.$transaction([
    prisma.cartItem.update({ where: { id: item.id }, data: d }),
    prisma.cart.update({
      where: { id: cart.id },
      data: { version: { increment: 1 } },
    }),
  ]);
  res.json({
    data: await readCart((await prisma.cart.findUnique({ where: { id: cart.id } }))!),
  });
});
commerce.delete('/cart/items/:id', async (req, res) => {
  const cart = await cartFor(req, res);
  await prisma.$transaction([
    prisma.cartItem.deleteMany({
      where: { id: id.parse(req.params.id), cartId: cart.id },
    }),
    prisma.cart.update({
      where: { id: cart.id },
      data: { version: { increment: 1 } },
    }),
  ]);
  res.json({
    data: await readCart((await prisma.cart.findUnique({ where: { id: cart.id } }))!),
  });
});
commerce.patch('/cart/context', async (req, res) => {
  const { marketId } = z.object({ marketId: z.string() }).parse(req.body);
  const m = storeConfig.markets.find((x) => x.enabled && x.id === marketId);
  if (!m) fail(422, 'MARKET_INVALID', 'This market is unavailable.');
  const cart = await cartFor(req, res);
  const updated = await prisma.cart.update({
    where: { id: cart.id },
    data: {
      marketId: m.id,
      currency: m.currency,
      couponCode: null,
      version: { increment: 1 },
    },
  });
  res.json({ data: await readCart(updated) });
});
commerce.post('/cart/coupon', async (req, res) => {
  const { code } = z
    .object({
      code: z
        .string()
        .trim()
        .max(30)
        .transform((v) => v.toUpperCase()),
    })
    .parse(req.body);
  const cart = await cartFor(req, res);
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (
    !coupon ||
    !coupon.active ||
    coupon.currency !== cart.currency ||
    coupon.used >= coupon.maxUses ||
    (coupon.expiresAt && coupon.expiresAt < new Date())
  )
    fail(422, 'COUPON_INVALID', 'This code is unavailable.');
  const updated = await prisma.cart.update({
    where: { id: cart.id },
    data: { couponCode: code, version: { increment: 1 } },
  });
  res.json({ data: await readCart(updated) });
});
commerce.delete('/cart/coupon', async (req, res) => {
  const cart = await cartFor(req, res);
  res.json({
    data: await readCart(
      await prisma.cart.update({
        where: { id: cart.id },
        data: { couponCode: null, version: { increment: 1 } },
      }),
    ),
  });
});
const quoteInput = z
  .object({
    contactEmail: z.email().transform((v) => v.toLowerCase()),
    shippingAddress: addressSchema,
    shippingMethodId: z.string().default('standard'),
  })
  .strict();
type QuoteInput = z.infer<typeof quoteInput>;
async function priceQuote(cart: Cart, input: QuoteInput, tx: Tx) {
  if (!storeConfig.shipping.configured || !storeConfig.tax.configured)
    fail(503, 'CHECKOUT_UNCONFIGURED', 'Delivery rules are being prepared.');
  const market = storeConfig.markets.find((m) => m.enabled && m.id === cart.marketId);
  if (!market || market.country !== input.shippingAddress.country)
    fail(422, 'SHIPPING_UNAVAILABLE', 'This address is outside your selected market.');
  const rate = storeConfig.shipping.rates.find(
    (s) =>
      s.id === input.shippingMethodId &&
      s.marketId === cart.marketId &&
      s.currency === cart.currency,
  );
  if (!rate) fail(422, 'SHIPPING_UNAVAILABLE', 'No delivery service is available.');
  const bag = await readCart(cart, tx);
  if (!bag.items.length) fail(422, 'BAG_EMPTY', 'Your bag is empty.');
  if (bag.items.some((i) => !i.purchasable || i.quantity > i.available))
    fail(409, 'STOCK_CHANGED', 'An item in your bag is no longer available.');
  let percent = 0;
  if (cart.couponCode) {
    const c = await tx.coupon.findUnique({ where: { code: cart.couponCode } });
    if (
      !c ||
      !c.active ||
      c.currency !== cart.currency ||
      c.used >= c.maxUses ||
      c.minimumMinor > bag.subtotalMinor ||
      (c.expiresAt && c.expiresAt < new Date())
    )
      fail(422, 'COUPON_INVALID', 'Remove the unavailable promotion code.');
    percent = c.percent;
  }
  const shipping = bag.subtotalMinor >= BigInt(rate.freeOverMinor) ? 0n : BigInt(rate.feeMinor);
  const totals = calculateTotals(
    bag.subtotalMinor,
    percent,
    shipping,
    storeConfig.tax.rateBasisPoints,
    storeConfig.tax.mode === 'inclusive',
    storeConfig.tax.shippingTaxable,
  );
  if (
    !storeConfig.checkout.cod.enabled ||
    !storeConfig.checkout.cod.countryAllowlist.includes(input.shippingAddress.country) ||
    totals.totalMinor > BigInt(storeConfig.checkout.cod.maximumByCurrency[cart.currency] ?? 0)
  )
    fail(422, 'COD_UNAVAILABLE', 'Cash on delivery is unavailable for this order.');
  return {
    ...input,
    marketId: cart.marketId,
    currency: cart.currency,
    couponCode: cart.couponCode,
    items: bag.items,
    totals,
  };
}
commerce.post('/checkout/quotes', async (req, res) => {
  const input = quoteInput.parse(req.body);
  if (!req.shopSession?.userId && !storeConfig.checkout.guestEnabled)
    fail(401, 'AUTH_REQUIRED', 'Please sign in to check out.');
  const cart = await cartFor(req, res);
  const payload = await priceQuote(cart, input, prisma);
  const q = await prisma.checkoutQuote.create({
    data: {
      cartId: cart.id,
      cartVersion: cart.version,
      configRevision: storeConfig.revision,
      payload: json(payload),
      expiresAt: new Date(Date.now() + storeConfig.checkout.quoteMinutes * 60000),
    },
  });
  res.status(201).json({ data: { ...q, ...payload } });
});
commerce.post('/checkout/orders', async (req, res) => {
  const { quoteId, paymentMethod } = z
    .object({ quoteId: id, paymentMethod: z.literal('COD') })
    .strict()
    .parse(req.body);
  const key = z.string().min(16).max(128).parse(req.get('Idempotency-Key'));
  const s = req.shopSession!;
  const fingerprint = digest(JSON.stringify({ quoteId, paymentMethod }));
  const order = await atomic(async (tx) => {
    const previous = await tx.order.findUnique({
      where: {
        sessionId_idempotencyKey: { sessionId: s.id, idempotencyKey: key },
      },
      include: { items: true, events: true, shipment: true },
    });
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        fail(409, 'IDEMPOTENCY_CONFLICT', 'This request key was used with different details.');
      return previous;
    }
    const q = await tx.checkoutQuote.findUnique({
      where: { id: quoteId },
      include: { cart: true },
    });
    if (
      !q ||
      !ownsCart(q.cart, s) ||
      q.consumedAt ||
      q.expiresAt < new Date() ||
      q.configRevision !== storeConfig.revision ||
      q.cartVersion !== q.cart.version
    )
      fail(409, 'QUOTE_EXPIRED', 'Your checkout quote changed. Review it again.');
    const saved = q.payload as Record<string, unknown>;
    const input = quoteInput.parse({
      contactEmail: saved.contactEmail,
      shippingAddress: saved.shippingAddress,
      shippingMethodId: saved.shippingMethodId,
    });
    const fresh = await priceQuote(q.cart, input, tx);
    if (canonical(json(fresh)) !== canonical(q.payload))
      fail(409, 'PRICE_CHANGED', 'Prices or stock changed. Refresh your checkout quote.');
    if (fresh.couponCode) {
      const c = await tx.coupon.updateMany({
        where: {
          code: fresh.couponCode,
          active: true,
          used: {
            lt: (await tx.coupon.findUnique({
              where: { code: fresh.couponCode },
            }))!.maxUses,
          },
        },
        data: { used: { increment: 1 } },
      });
      if (!c.count) fail(409, 'COUPON_INVALID', 'This promotion is no longer available.');
    }
    const number = `KV-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
    const created = await tx.order.create({
      data: {
        number,
        sessionId: s.id,
        userId: s.userId,
        email: input.contactEmail,
        marketId: q.cart.marketId,
        currency: q.cart.currency,
        locale: storeConfig.defaultLocale,
        configRevision: storeConfig.revision,
        address: json(input.shippingAddress),
        ...fresh.totals,
        couponCode: fresh.couponCode,
        idempotencyKey: key,
        fingerprint,
        items: {
          create: fresh.items.map((i) => ({
            variantId: i.variantId,
            name: i.name,
            sku: i.sku,
            category: i.category,
            art: i.art,
            color: i.color,
            quantity: i.quantity,
            unitPriceMinor: i.unitPriceMinor,
            lineTotalMinor: i.unitPriceMinor * BigInt(i.quantity),
          })),
        },
      },
    });
    for (const i of [...fresh.items].sort((a, b) => a.variantId.localeCompare(b.variantId)))
      await moveStock(
        tx,
        i.variantId,
        0,
        i.quantity,
        'ORDER_ALLOCATED',
        `${created.id}:${i.variantId}:allocate`,
        s.userId ?? undefined,
      );
    await event(
      tx,
      created.id,
      'CONFIRMED',
      'Order confirmed. Payment will be collected on delivery.',
    );
    await email(
      tx,
      created.email,
      `Order ${number} confirmed`,
      `Your cash on delivery order ${number} is confirmed. Total: ${fresh.totals.totalMinor} minor units ${created.currency}.`,
    );
    await tx.checkoutQuote.update({
      where: { id: q.id },
      data: { consumedAt: new Date() },
    });
    await tx.cartItem.deleteMany({ where: { cartId: q.cartId } });
    await tx.cart.update({
      where: { id: q.cartId },
      data: { version: { increment: 1 }, couponCode: null },
    });
    return tx.order.findUniqueOrThrow({
      where: { id: created.id },
      include: { items: true, events: true, shipment: true },
    });
  });
  res.status(201).json({ data: order });
});
export function canView(req: Request, o: Order) {
  return (
    req.shopSession?.user?.role === 'ADMIN' ||
    (!!req.shopSession &&
      ((o.userId && o.userId === req.shopSession.userId) ||
        o.sessionId === req.shopSession.id ||
        o.id === req.shopSession.guestOrderId))
  );
}
commerce.get('/orders', async (req, res) => {
  const s = req.shopSession;
  if (!s) fail(401, 'AUTH_REQUIRED', 'Sign in to view orders.');
  res.json({
    data: await prisma.order.findMany({
      where: s.userId ? { userId: s.userId } : { sessionId: s.id },
      include: { items: true, shipment: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  });
});
commerce.get('/orders/:id', async (req, res) => {
  const o = await prisma.order.findUnique({
    where: { id: id.parse(req.params.id) },
    include: {
      items: true,
      events: { orderBy: { createdAt: 'asc' } },
      shipment: true,
      returns: true,
      refunds: true,
    },
  });
  if (!o || !canView(req, o)) fail(404, 'NOT_FOUND', 'Order was not found.');
  res.json({ data: o });
});
export async function cancelOrder(req: Request, orderId: string, admin = false) {
  return atomic(async (tx) => {
    const o = await lockOrder(tx, orderId);
    if (!o || !canView(req, o)) fail(404, 'NOT_FOUND', 'Order was not found.');
    if (o.status === 'CANCELLED') return o;
    if (o.shipment || o.fulfillment === 'SHIPPED' || o.fulfillment === 'DELIVERED')
      fail(409, 'CANCELLATION_CLOSED', 'This order has already shipped.');
    if (o.paymentStatus !== 'UNPAID')
      fail(409, 'REFUND_REQUIRED', 'Record a refund before cancelling this collected order.');
    for (const i of o.items)
      await moveStock(
        tx,
        i.variantId,
        0,
        -i.quantity,
        'ORDER_CANCELLED',
        `${o.id}:${i.variantId}:cancel`,
        req.shopSession?.userId ?? undefined,
      );
    await event(
      tx,
      o.id,
      'CANCELLED',
      admin ? 'Cancelled by the store.' : 'Cancelled by customer.',
      req.shopSession?.userId ?? undefined,
    );
    return tx.order.update({
      where: { id: o.id },
      data: { status: 'CANCELLED', version: { increment: 1 } },
    });
  });
}
commerce.post('/orders/:id/cancellations', async (req, res) =>
  res.json({ data: await cancelOrder(req, id.parse(req.params.id)) }),
);
commerce.post('/orders/:id/returns', async (req, res) => {
  const input = z
    .object({
      reason: z.string().trim().min(5).max(1000),
      items: z.array(z.object({ orderItemId: id, quantity: z.number().int().min(1) })).min(1),
    })
    .parse(req.body);
  const result = await atomic(async (tx) => {
    const o = await lockOrder(tx, id.parse(req.params.id));
    if (!o || !canView(req, o)) fail(404, 'NOT_FOUND', 'Order was not found.');
    if (
      o.fulfillment !== 'DELIVERED' ||
      !o.shipment?.deliveredAt ||
      Date.now() - o.shipment.deliveredAt.getTime() > storeConfig.returns.windowDays * 86400000
    )
      fail(422, 'RETURN_INELIGIBLE', 'This order is outside its return window.');
    if (new Set(input.items.map((i) => i.orderItemId)).size !== input.items.length)
      fail(422, 'VALIDATION_FAILED', 'Duplicate return items.');
    for (const item of input.items) {
      const line = o.items.find((i) => i.id === item.orderItemId);
      if (!line || item.quantity > line.quantity - line.returnedQuantity)
        fail(422, 'RETURN_INELIGIBLE', 'Return quantity is unavailable.');
    }
    if (o.returns.some((r) => ['REQUESTED', 'APPROVED'].includes(r.status)))
      fail(409, 'RETURN_PENDING', 'An earlier return request is still open.');
    await event(tx, o.id, 'RETURN_REQUESTED', input.reason);
    return tx.returnRequest.create({
      data: { orderId: o.id, reason: input.reason, items: json(input.items) },
    });
  });
  res.status(201).json({ data: result });
});
