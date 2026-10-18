import { saveStoreSettings } from '../services/store-settings.js';
import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db/client.js';
import { storeConfig } from '../config.js';
import { requireAdmin } from '../middleware/authorization.js';
import { audit, atomic, csvCell, event, fail, id, lockOrder, moveStock } from '../services/core.js';
import { cancelOrder } from './commerce.js';
import { media } from './media.js';
import { pageInput, pageWindow, sendPage } from '../services/pagination.js';
import { productInput } from '../services/products.js';
export const admin = Router();
admin.use(requireAdmin);
admin.get('/dashboard', async (req, res) => {
  const range = z.enum(['7d', '30d', '90d']).catch('30d').parse(req.query.range);
  const currency = String(req.query.currency ?? storeConfig.currencies[0].code);
  if (!storeConfig.currencies.some((c) => c.code === currency))
    fail(422, 'CURRENCY_INVALID', 'Unknown currency.');
  const days = Number(range.slice(0, -1));
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const prior = new Date(start.getTime() - days * 86400000);
  const orders = await prisma.order.findMany({
    where: {
      currency,
      OR: [
        { createdAt: { gte: prior } },
        { events: { some: { type: 'COD_COLLECTED', createdAt: { gte: prior } } } },
        { refunds: { some: { createdAt: { gte: prior } } } },
      ],
    },
    include: { items: true, events: { where: { type: 'COD_COLLECTED' } }, refunds: true },
    orderBy: { createdAt: 'desc' },
  });
  const inRange = (date: Date, from: Date, to: Date) => date >= from && date < to;
  const cash = (o: (typeof orders)[number], from: Date, to: Date) => {
    const merchandise = o.subtotalMinor - o.discountMinor;
    const receipt = o.events.some((e) => inRange(e.createdAt, from, to)) ? merchandise : 0n;
    const refunds = o.refunds
      .filter((r) => inRange(r.createdAt, from, to))
      .reduce((sum, r) => sum + r.amountMinor, 0n);
    return Number(
      receipt - (o.totalMinor ? (refunds * merchandise + o.totalMinor / 2n) / o.totalMinor : 0n),
    );
  };
  const summarize = (from: Date, to: Date) => {
    const list = orders.filter((o) => o.status !== 'CANCELLED' && inRange(o.createdAt, from, to));
    return {
      revenue: orders.reduce((sum, o) => sum + cash(o, from, to), 0),
      orders: list.length,
      aov: list.length
        ? Math.round(
            list.reduce((sum, o) => sum + Number(o.subtotalMinor - o.discountMinor), 0) /
              list.length,
          )
        : 0,
      customers: new Set(list.map((o) => o.userId ?? o.email)).size,
    };
  };
  const current = orders.filter(
    (o) => o.status !== 'CANCELLED' && inRange(o.createdAt, start, end),
  );
  const metrics = summarize(start, end),
    comparison = summarize(prior, start);
  const series = Array.from({ length: days }, (_, i) => {
    const from = new Date(start.getTime() + i * 86400000),
      to = new Date(from.getTime() + 86400000);
    return { date: from.toISOString(), ...summarize(from, to) };
  });
  const categories: Record<string, number> = {};
  for (const o of orders) {
    const revenue = cash(o, start, end);
    const gross = o.items.reduce((sum, i) => sum + Number(i.lineTotalMinor), 0);
    if (!revenue || !gross) continue;
    for (const item of o.items)
      categories[item.category] =
        (categories[item.category] ?? 0) + (revenue * Number(item.lineTotalMinor)) / gross;
  }
  const dateKey = (date: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: storeConfig.timezone }).format(date);
  const todayKey = dateKey(end);
  const todayOrders = orders.filter(
    (o) => o.status !== 'CANCELLED' && dateKey(o.createdAt) === todayKey,
  );
  const today = {
    orders: todayOrders.length,
    customers: new Set(todayOrders.map((o) => o.userId ?? o.email)).size,
    aov: todayOrders.length
      ? Math.round(
          todayOrders.reduce((sum, o) => sum + Number(o.subtotalMinor - o.discountMinor), 0) /
            todayOrders.length,
        )
      : 0,
    revenue: orders.reduce((sum, o) => {
      const merchandise = o.subtotalMinor - o.discountMinor;
      const receipt = o.events.some((e) => dateKey(e.createdAt) === todayKey)
        ? Number(merchandise)
        : 0;
      const refund = o.refunds
        .filter((r) => dateKey(r.createdAt) === todayKey)
        .reduce((n, r) => n + r.amountMinor, 0n);
      return (
        sum +
        receipt -
        Number(o.totalMinor ? (refund * merchandise + o.totalMinor / 2n) / o.totalMinor : 0n)
      );
    }, 0),
  };
  res.json({
    data: {
      range,
      currency,
      timezone: storeConfig.timezone,
      computedAt: end,
      metrics,
      comparison,
      series,
      categories,
      today,
      goalMinor: storeConfig.dashboard.dailyGoalByCurrency[currency] ?? 0,
      recent: current.slice(0, 12),
    },
  });
});
admin.get('/orders', async (req, res) => {
  const q = pageInput
    .extend({
      q: z.string().max(100).optional(),
      status: z.enum(['CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED']).optional(),
    })
    .parse(req.query);
  const where = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.q
      ? {
          OR: [
            { number: { contains: q.q, mode: 'insensitive' as const } },
            { email: { contains: q.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true, shipment: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.order.count({ where }),
  ]);
  res.json({
    data,
    meta: {
      total,
      totalItems: total,
      page: q.page,
      currentPage: q.page,
      limit: q.limit,
      pages: Math.ceil(total / q.limit),
      totalPages: Math.ceil(total / q.limit),
      hasNextPage: q.page < Math.ceil(total / q.limit),
    },
  });
});
admin.get('/orders/:id', async (req, res) => {
  const o = await prisma.order.findUnique({
    where: { id: id.parse(req.params.id) },
    include: {
      items: true,
      events: { orderBy: { createdAt: 'asc' } },
      shipment: true,
      returns: true,
      refunds: true,
      user: { select: { name: true } },
    },
  });
  if (!o) fail(404, 'NOT_FOUND', 'Order not found.');
  res.json({ data: o });
});
admin.post('/orders/:id/processing', async (req, res) =>
  res.json({
    data: await atomic(async (tx) => {
      const o = await lockOrder(tx, id.parse(req.params.id));
      if (!o || o.status === 'CANCELLED' || o.shipment)
        fail(409, 'STATE_CONFLICT', 'This order cannot be processed.');
      await event(
        tx,
        o.id,
        'PROCESSING',
        'The store is preparing your order.',
        req.shopSession!.userId!,
      );
      return tx.order.update({
        where: { id: o.id },
        data: {
          status: 'PROCESSING',
          fulfillment: 'PROCESSING',
          version: { increment: 1 },
        },
      });
    }),
  }),
);
admin.post('/orders/:id/cancellations', async (req, res) =>
  res.json({ data: await cancelOrder(req, id.parse(req.params.id), true) }),
);
admin.post('/orders/:id/shipments', async (req, res) => {
  const d = z
    .object({
      carrier: z.string().trim().min(2).max(80),
      tracking: z.string().trim().min(2).max(100),
    })
    .strict()
    .parse(req.body);
  res.status(201).json({
    data: await atomic(async (tx) => {
      const o = await lockOrder(tx, id.parse(req.params.id));
      if (!o || o.status === 'CANCELLED' || o.shipment)
        fail(409, 'STATE_CONFLICT', 'This order cannot be shipped.');
      for (const i of o.items)
        await moveStock(
          tx,
          i.variantId,
          -i.quantity,
          -i.quantity,
          'SHIPPED',
          `${o.id}:${i.variantId}:ship`,
          req.shopSession!.userId!,
        );
      await tx.shipment.create({ data: { orderId: o.id, ...d } });
      await event(
        tx,
        o.id,
        'SHIPPED',
        `Shipped with ${d.carrier}. Tracking: ${d.tracking}`,
        req.shopSession!.userId!,
      );
      await audit(tx, req.shopSession!.userId!, 'ORDER_SHIPPED', o.id, d);
      return tx.order.update({
        where: { id: o.id },
        data: {
          fulfillment: 'SHIPPED',
          status: 'PROCESSING',
          version: { increment: 1 },
        },
      });
    }),
  });
});
admin.post('/orders/:id/delivery', async (req, res) =>
  res.json({
    data: await atomic(async (tx) => {
      const o = await lockOrder(tx, id.parse(req.params.id));
      if (!o?.shipment || o.fulfillment !== 'SHIPPED')
        fail(409, 'STATE_CONFLICT', 'Only shipped orders can be delivered.');
      await tx.shipment.update({
        where: { orderId: o.id },
        data: { deliveredAt: new Date() },
      });
      await event(
        tx,
        o.id,
        'DELIVERED',
        'Your order has been delivered.',
        req.shopSession!.userId!,
      );
      return tx.order.update({
        where: { id: o.id },
        data: {
          fulfillment: 'DELIVERED',
          status: 'COMPLETED',
          version: { increment: 1 },
        },
      });
    }),
  }),
);
admin.post('/orders/:id/cod-collections', async (req, res) =>
  res.json({
    data: await atomic(async (tx) => {
      const o = await lockOrder(tx, id.parse(req.params.id));
      if (!o || o.fulfillment !== 'DELIVERED' || o.paymentStatus !== 'UNPAID')
        fail(409, 'STATE_CONFLICT', 'Only delivered unpaid COD orders can be collected.');
      await event(
        tx,
        o.id,
        'COD_COLLECTED',
        'Cash payment collected on delivery.',
        req.shopSession!.userId!,
      );
      await audit(tx, req.shopSession!.userId!, 'COD_COLLECTED', o.id);
      return tx.order.update({
        where: { id: o.id },
        data: { paymentStatus: 'PAID', version: { increment: 1 } },
      });
    }),
  }),
);
admin.post('/orders/:id/refunds', async (req, res) => {
  const d = z
    .object({
      amountMinor: z.coerce.bigint().positive(),
      reason: z.string().trim().min(5).max(1000),
      reference: z.string().trim().min(3).max(100),
    })
    .strict()
    .parse(req.body);
  const key = z.string().min(16).max(128).parse(req.get('Idempotency-Key'));
  res.status(201).json({
    data: await atomic(async (tx) => {
      const orderId = id.parse(req.params.id);
      const old = await tx.refund.findUnique({
        where: { idempotencyKey: key },
      });
      if (old) {
        if (
          old.orderId !== orderId ||
          old.amountMinor !== d.amountMinor ||
          old.reference !== d.reference ||
          old.reason !== d.reason
        )
          fail(409, 'IDEMPOTENCY_CONFLICT', 'This refund key was used for another request.');
        return old;
      }
      const o = await lockOrder(tx, orderId);
      if (
        !o ||
        !['PAID', 'PARTIALLY_REFUNDED'].includes(o.paymentStatus) ||
        o.refundedMinor + d.amountMinor > o.totalMinor
      )
        fail(422, 'REFUND_INVALID', 'Refund exceeds the collected unrefunded balance.');
      const refunded = o.refundedMinor + d.amountMinor;
      const r = await tx.refund.create({
        data: { orderId: o.id, ...d, idempotencyKey: key },
      });
      await tx.order.update({
        where: { id: o.id },
        data: {
          refundedMinor: refunded,
          paymentStatus: refunded === o.totalMinor ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          version: { increment: 1 },
        },
      });
      await event(
        tx,
        o.id,
        'MANUAL_REFUND',
        `Manual COD refund recorded. Reference: ${d.reference}`,
        req.shopSession!.userId!,
      );
      await audit(tx, req.shopSession!.userId!, 'MANUAL_REFUND', o.id, {
        ...d,
        amountMinor: d.amountMinor.toString(),
      });
      return r;
    }),
  });
});
admin.get('/products', async (req, res) => {
  const query = pageInput.parse(req.query);
  const where = query.q
    ? {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' as const } },
          { variants: { some: { sku: { contains: query.q, mode: 'insensitive' as const } } } },
        ],
      }
    : {};
  await sendPage(
    res,
    query,
    prisma.product.findMany({
      where,
      include: { category: true, variants: { include: { prices: true, inventory: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...pageWindow(query),
    }),
    prisma.product.count({ where }),
  );
});
admin.get('/products/:id', async (req, res) => {
  const p = await prisma.product.findUnique({
    where: { id: id.parse(req.params.id) },
    include: {
      category: true,
      variants: { include: { prices: true, inventory: true } },
    },
  });
  if (!p) fail(404, 'NOT_FOUND', 'Product not found.');
  res.json({ data: p });
});
admin.post('/products', async (req, res) => {
  const d = productInput.parse(req.body);
  const { sku, label, priceMinor, onHand, version: _version, ...data } = d;
  const m = storeConfig.markets.find((x) => x.id === storeConfig.defaultMarketId)!;
  res.status(201).json({
    data: await atomic(async (tx) => {
      const p = await tx.product.create({
        data: {
          ...data,
          mediaAssetId: await resolveMedia(tx, data.imageUrl),
          variants: {
            create: {
              sku,
              label,
              prices: {
                create: {
                  marketId: m.id,
                  currency: m.currency,
                  amountMinor: priceMinor,
                },
              },
              inventory: { create: { onHand: 0 } },
            },
          },
        },
        include: { variants: true },
      });
      if (onHand)
        await moveStock(
          tx,
          p.variants[0].id,
          onHand,
          0,
          'OPENING_STOCK',
          randomUUID(),
          req.shopSession!.userId!,
        );
      await audit(tx, req.shopSession!.userId!, 'PRODUCT_CREATED', p.id);
      return p;
    }),
  });
});
admin.patch('/products/:id', async (req, res) => {
  const d = productInput.parse(req.body);
  const { sku, label, priceMinor, onHand, version, ...data } = d;
  const m = storeConfig.markets.find((x) => x.id === storeConfig.defaultMarketId)!;
  res.json({
    data: await atomic(async (tx) => {
      const productId = id.parse(req.params.id);
      const p = await tx.product.findUnique({
        where: { id: productId },
        include: { variants: { include: { inventory: true } } },
      });
      if (!p) fail(404, 'NOT_FOUND', 'Product not found.');
      if (version !== p.version)
        fail(409, 'VERSION_CONFLICT', 'Another edit changed this product. Reload it first.');
      const v = p.variants[0];
      if (!v) fail(409, 'VARIANT_REQUIRED', 'Create a purchasable variant first.');
      await tx.product.update({
        where: { id: p.id },
        data: {
          ...data,
          mediaAssetId: await resolveMedia(tx, data.imageUrl),
          version: { increment: 1 },
        },
      });
      await tx.productVariant.update({
        where: { id: v.id },
        data: { sku, label },
      });
      await tx.price.upsert({
        where: {
          variantId_marketId_currency: {
            variantId: v.id,
            marketId: m.id,
            currency: m.currency,
          },
        },
        create: {
          variantId: v.id,
          marketId: m.id,
          currency: m.currency,
          amountMinor: priceMinor,
        },
        update: { amountMinor: priceMinor },
      });
      if (v.inventory && onHand !== v.inventory.onHand)
        await moveStock(
          tx,
          v.id,
          onHand - v.inventory.onHand,
          0,
          'PRODUCT_STOCK_EDIT',
          randomUUID(),
          req.shopSession!.userId!,
        );
      await audit(tx, req.shopSession!.userId!, 'PRODUCT_UPDATED', p.id, {
        version: p.version + 1,
      });
      return tx.product.findUnique({
        where: { id: p.id },
        include: { variants: { include: { prices: true, inventory: true } } },
      });
    }),
  });
});
admin.post('/products/:id/archive', async (req, res) =>
  res.json({
    data: await atomic(async (tx) => {
      const p = await tx.product.update({
        where: { id: id.parse(req.params.id) },
        data: { status: 'ARCHIVED', version: { increment: 1 } },
      });
      await audit(tx, req.shopSession!.userId!, 'PRODUCT_ARCHIVED', p.id);
      return p;
    }),
  }),
);
admin.get('/categories/options', async (_req, res) =>
  res.json({
    data: await prisma.category.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }),
  }),
);
admin.get('/categories', async (req, res) => {
  const query = pageInput.parse(req.query),
    where = query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' as const } },
            { slug: { contains: query.q, mode: 'insensitive' as const } },
          ],
        }
      : {};
  await sendPage(
    res,
    query,
    prisma.category.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      ...pageWindow(query),
    }),
    prisma.category.count({ where }),
  );
});
const catInput = z
  .object({
    name: z.string().min(2).max(80),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(80),
    description: z.string().max(1000).default(''),
    sortOrder: z.number().int().min(0).max(1000).default(0),
    active: z.boolean().default(true),
  })
  .strict();
admin.post('/categories', async (req, res) =>
  res.status(201).json({
    data: await adminMutation(req, 'CATEGORY_CREATED', (tx) =>
      tx.category.create({ data: catInput.parse(req.body) }),
    ),
  }),
);
admin.patch('/categories/:id', async (req, res) =>
  res.json({
    data: await adminMutation(req, 'CATEGORY_UPDATED', (tx) =>
      tx.category.update({
        where: { id: id.parse(req.params.id) },
        data: catInput.parse(req.body),
      }),
    ),
  }),
);
admin.delete('/categories/:id', async (req, res) => {
  const categoryId = id.parse(req.params.id);
  if (await prisma.product.count({ where: { categoryId } }))
    fail(409, 'CATEGORY_IN_USE', 'Reassign products before removing this category.');
  await adminMutation(req, 'CATEGORY_DELETED', (tx) =>
    tx.category.delete({ where: { id: categoryId } }),
  );
  res.json({ data: { ok: true } });
});
admin.get('/inventory', async (req, res) => {
  const query = pageInput.parse(req.query),
    where = query.q
      ? {
          variant: {
            OR: [
              { sku: { contains: query.q, mode: 'insensitive' as const } },
              { product: { name: { contains: query.q, mode: 'insensitive' as const } } },
            ],
          },
        }
      : {};
  await sendPage(
    res,
    query,
    prisma.inventory.findMany({
      where,
      include: {
        variant: { include: { product: true } },
        movements: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: [{ onHand: 'asc' }, { id: 'asc' }],
      ...pageWindow(query),
    }),
    prisma.inventory.count({ where }),
  );
});
admin.post('/inventory/:id/adjustments', async (req, res) => {
  const d = z
    .object({
      delta: z
        .number()
        .int()
        .min(-10000)
        .max(10000)
        .refine((value) => value !== 0, 'Enter a non-zero stock adjustment.'),
      reason: z.string().trim().min(5).max(200),
      version: z.number().int(),
    })
    .strict()
    .parse(req.body);
  const updated = await atomic(async (tx) => {
    const i = await tx.inventory.findUnique({
      where: { id: id.parse(req.params.id) },
    });
    if (!i) fail(404, 'NOT_FOUND', 'Inventory record not found.');
    if (i.version !== d.version)
      fail(409, 'VERSION_CONFLICT', 'Stock changed. Refresh before adjusting it.');
    await moveStock(tx, i.variantId, d.delta, 0, d.reason, randomUUID(), req.shopSession!.userId!);
    await audit(tx, req.shopSession!.userId!, 'STOCK_ADJUSTED', i.id, d);
    return tx.inventory.findUniqueOrThrow({
      where: { id: i.id },
      include: {
        variant: { include: { product: true } },
        movements: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  });
  res.json({ data: updated });
});
admin.get('/returns', async (req, res) => {
  const query = pageInput.parse(req.query),
    where = query.q
      ? {
          OR: [
            { reason: { contains: query.q, mode: 'insensitive' as const } },
            { order: { number: { contains: query.q, mode: 'insensitive' as const } } },
          ],
        }
      : {};
  await sendPage(
    res,
    query,
    prisma.returnRequest.findMany({
      where,
      include: { order: { include: { items: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...pageWindow(query),
    }),
    prisma.returnRequest.count({ where }),
  );
});
admin.post('/returns/:id/decisions', async (req, res) => {
  const d = z
    .object({
      status: z.enum(['APPROVED', 'REJECTED']),
      resolution: z.string().min(3).max(1000),
    })
    .parse(req.body);
  res.json({
    data: await atomic(async (tx) => {
      const r = await tx.returnRequest.findUnique({
        where: { id: id.parse(req.params.id) },
      });
      if (!r) fail(404, 'NOT_FOUND', 'Return not found.');
      await lockOrder(tx, r.orderId);
      if (r.status !== 'REQUESTED')
        fail(409, 'STATE_CONFLICT', 'This return has already been reviewed.');
      await event(tx, r.orderId, `RETURN_${d.status}`, d.resolution, req.shopSession!.userId!);
      return tx.returnRequest.update({ where: { id: r.id }, data: d });
    }),
  });
});
admin.post('/returns/:id/receipts', async (req, res) => {
  const d = z
    .object({ restock: z.boolean(), resolution: z.string().min(3).max(1000) })
    .parse(req.body);
  res.json({
    data: await atomic(async (tx) => {
      const r = await tx.returnRequest.findUnique({
        where: { id: id.parse(req.params.id) },
      });
      if (!r) fail(404, 'NOT_FOUND', 'Return not found.');
      const o = await lockOrder(tx, r.orderId);
      const latest = await tx.returnRequest.findUniqueOrThrow({
        where: { id: r.id },
      });
      if (latest.status !== 'APPROVED' || !o)
        fail(409, 'STATE_CONFLICT', 'Only approved returns can be received.');
      const items = z
        .array(z.object({ orderItemId: id, quantity: z.number().int().positive() }))
        .parse(r.items);
      for (const line of items) {
        const i = o.items.find((x) => x.id === line.orderItemId);
        if (!i || line.quantity > i.quantity - i.returnedQuantity)
          fail(409, 'RETURN_INELIGIBLE', 'Return quantity changed.');
        await tx.orderItem.update({
          where: { id: i.id },
          data: { returnedQuantity: { increment: line.quantity } },
        });
        if (d.restock)
          await moveStock(
            tx,
            i.variantId,
            line.quantity,
            0,
            'RETURN_RECEIVED',
            `${r.id}:${i.id}:restock`,
            req.shopSession!.userId!,
          );
      }
      await event(
        tx,
        o.id,
        'RETURN_RECEIVED',
        'Returned items received and inspected.',
        req.shopSession!.userId!,
      );
      return tx.returnRequest.update({
        where: { id: r.id },
        data: { status: 'RECEIVED', resolution: d.resolution },
      });
    }),
  });
});
admin.get('/reviews', async (req, res) => {
  const query = pageInput.parse(req.query),
    where = query.q
      ? {
          OR: [
            { body: { contains: query.q, mode: 'insensitive' as const } },
            { product: { name: { contains: query.q, mode: 'insensitive' as const } } },
          ],
        }
      : {};
  await sendPage(
    res,
    query,
    prisma.review.findMany({
      where,
      include: { product: { select: { name: true } }, user: { select: { name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...pageWindow(query),
    }),
    prisma.review.count({ where }),
  );
});
admin.patch('/reviews/:id', async (req, res) =>
  res.json({
    data: await adminMutation(req, 'REVIEW_MODERATED', (tx) =>
      tx.review.update({
        where: { id: id.parse(req.params.id) },
        data: z.object({ published: z.boolean() }).strict().parse(req.body),
      }),
    ),
  }),
);
admin.get('/coupons', async (req, res) => {
  const query = pageInput.parse(req.query),
    where = query.q ? { code: { contains: query.q, mode: 'insensitive' as const } } : {};
  await sendPage(
    res,
    query,
    prisma.coupon.findMany({ where, orderBy: { code: 'asc' }, ...pageWindow(query) }),
    prisma.coupon.count({ where }),
  );
});
const couponInput = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .transform((v) => v.toUpperCase()),
    percent: z.number().int().min(1).max(100),
    minimumMinor: z.coerce.bigint().nonnegative(),
    maxUses: z.number().int().min(1).max(100000),
    currency: z.string().length(3),
    active: z.boolean(),
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .strict();
admin.post('/coupons', async (req, res) =>
  res.status(201).json({
    data: await adminMutation(req, 'COUPON_CREATED', (tx) =>
      tx.coupon.create({ data: couponInput.parse(req.body) }),
    ),
  }),
);
admin.patch('/coupons/:id', async (req, res) =>
  res.json({
    data: await adminMutation(req, 'COUPON_UPDATED', (tx) =>
      tx.coupon.update({
        where: { id: id.parse(req.params.id) },
        data: couponInput.parse(req.body),
      }),
    ),
  }),
);
admin.get('/content', async (req, res) => {
  const query = pageInput.parse(req.query),
    where = query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: 'insensitive' as const } },
            { key: { contains: query.q, mode: 'insensitive' as const } },
          ],
        }
      : {};
  await sendPage(
    res,
    query,
    prisma.contentRevision.findMany({
      where,
      orderBy: [{ key: 'asc' }, { revision: 'desc' }],
      ...pageWindow(query),
    }),
    prisma.contentRevision.count({ where }),
  );
});
admin.post('/content', async (req, res) => {
  const d = z
    .object({
      key: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .max(100),
      title: z.string().max(200),
      body: z.string().max(10000),
    })
    .strict()
    .parse(req.body);
  res.status(201).json({
    data: await atomic(async (tx) => {
      const old = await tx.contentRevision.findFirst({
        where: { key: d.key },
        orderBy: { revision: 'desc' },
      });
      const draft = await tx.contentRevision.create({
        data: { ...d, revision: (old?.revision ?? 0) + 1 },
      });
      await audit(tx, req.shopSession!.userId!, 'CONTENT_DRAFTED', draft.id);
      return draft;
    }),
  });
});
admin.post('/content/:id/publish', async (req, res) =>
  res.json({
    data: await atomic(async (tx) => {
      const revision = await tx.contentRevision.findUnique({
        where: { id: id.parse(req.params.id) },
      });
      if (!revision) fail(404, 'NOT_FOUND', 'Content revision not found.');
      await tx.contentRevision.updateMany({
        where: { key: revision.key },
        data: { published: false },
      });
      await audit(tx, req.shopSession!.userId!, 'CONTENT_PUBLISHED', revision.id);
      return tx.contentRevision.update({
        where: { id: revision.id },
        data: { published: true },
      });
    }),
  }),
);
admin.get('/config', (_req, res) =>
  res.json({
    data: {
      config: storeConfig,
      integrations: {
        email: !!process.env.SMTP_HOST,
        storage: !!process.env.AWS_ENDPOINT_URL_S3,
        payment: 'COMING_SOON',
        databaseBranch: process.env.NEON_BRANCH,
      },
      message:
        'Validated settings persist in PostgreSQL and survive restarts. The JSON profile is the initial default. Credentials and deployment security remain server-controlled.',
    },
  }),
);
admin.put('/config', async (req, res) => {
  const input = z
    .object({ profile: z.unknown(), expectedRevision: z.string().min(1).max(200) })
    .strict()
    .parse(req.body);
  res.json({
    data: await saveStoreSettings(input.profile, input.expectedRevision, req.shopSession!.userId!),
  });
});
admin.get('/audit', async (req, res) => {
  const query = pageInput.parse(req.query),
    where = query.q
      ? {
          OR: [
            { action: { contains: query.q, mode: 'insensitive' as const } },
            { target: { contains: query.q, mode: 'insensitive' as const } },
          ],
        }
      : {};
  await sendPage(
    res,
    query,
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...pageWindow(query),
    }),
    prisma.auditLog.count({ where }),
  );
});
admin.get('/notifications', async (req, res) => {
  const query = pageInput.parse(req.query),
    where = query.q
      ? {
          OR: [
            { type: { contains: query.q, mode: 'insensitive' as const } },
            { error: { contains: query.q, mode: 'insensitive' as const } },
          ],
        }
      : {};
  const rows = prisma.outboxJob
    .findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], ...pageWindow(query) })
    .then((jobs) =>
      jobs.map((job) => ({
        ...job,
        payload: storeConfig.mode === 'demo' ? job.payload : { redacted: true },
      })),
    );
  await sendPage(res, query, rows, prisma.outboxJob.count({ where }));
});
admin.get('/exports/orders', async (req, res) => {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });
  await prisma.auditLog.create({
    data: {
      actorId: req.shopSession!.userId,
      action: 'ORDERS_EXPORTED',
      target: 'orders',
      details: { count: orders.length },
    },
  });
  res
    .type('text/csv')
    .attachment('orders.csv')
    .send(
      [
        ['Order', 'Date', 'Email', 'Status', 'Payment', 'Currency', 'Total minor units']
          .map(csvCell)
          .join(','),
        ...orders.map((o) =>
          [
            o.number,
            o.createdAt.toISOString(),
            o.email,
            o.status,
            o.paymentStatus,
            o.currency,
            o.totalMinor.toString(),
          ]
            .map(csvCell)
            .join(','),
        ),
      ].join('\n'),
    );
});

admin.put('/variants/:id/prices', async (req, res) => {
  const d = z
    .object({
      marketId: z.string(),
      currency: z.string().length(3),
      amountMinor: z.coerce.bigint().nonnegative().max(1000000000000n),
    })
    .strict()
    .parse(req.body);
  const m = storeConfig.markets.find(
    (m) => m.enabled && m.id === d.marketId && m.currency === d.currency,
  );
  if (!m) fail(422, 'MARKET_INVALID', 'Choose a configured market and currency.');
  const variantId = id.parse(req.params.id);
  res.json({
    data: await atomic(async (tx) => {
      const p = await tx.price.upsert({
        where: { variantId_marketId_currency: { variantId, marketId: m.id, currency: m.currency } },
        create: { variantId, ...d },
        update: { amountMinor: d.amountMinor },
      });
      await audit(tx, req.shopSession!.userId!, 'PRICE_BOOK_UPDATED', variantId, {
        ...d,
        amountMinor: d.amountMinor.toString(),
      });
      return p;
    }),
  });
});
admin.post('/notifications/:id/retry', async (req, res) => {
  res.json({
    data: await atomic(async (tx) => {
      const job = await tx.outboxJob.findUnique({ where: { id: id.parse(req.params.id) } });
      if (!job || job.status !== 'FAILED')
        fail(409, 'STATE_CONFLICT', 'Only failed deliveries can be retried.');
      await audit(tx, req.shopSession!.userId!, 'NOTIFICATION_RETRIED', job.id);
      return tx.outboxJob.update({
        where: { id: job.id },
        data: {
          status: 'PENDING',
          attempts: 0,
          error: null,
          leaseUntil: null,
          availableAt: new Date(),
        },
      });
    }),
  });
});

admin.use('/media', media);

async function resolveMedia(tx: import('../services/core.js').Tx, url: string) {
  if (!url.startsWith('/media/')) return null;
  const asset = await tx.mediaAsset.findUnique({ where: { url } });
  if (!asset) fail(422, 'IMAGE_INVALID', 'Choose an existing image from the media library.');
  return asset.id;
}

admin.post('/products/:id/variants', async (req, res) => {
  const d = z
    .object({
      sku: z.string().min(2).max(60),
      label: z.string().min(2).max(100),
      onHand: z.number().int().min(0).max(100000),
      priceMinor: z.coerce.bigint().nonnegative().max(1000000000000n),
    })
    .strict()
    .parse(req.body);
  const market = storeConfig.markets.find((m) => m.id === storeConfig.defaultMarketId)!;
  res.status(201).json({
    data: await atomic(async (tx) => {
      const variant = await tx.productVariant.create({
        data: {
          productId: id.parse(req.params.id),
          sku: d.sku,
          label: d.label,
          prices: {
            create: { marketId: market.id, currency: market.currency, amountMinor: d.priceMinor },
          },
          inventory: { create: { onHand: 0 } },
        },
      });
      if (d.onHand)
        await moveStock(
          tx,
          variant.id,
          d.onHand,
          0,
          'OPENING_STOCK',
          randomUUID(),
          req.shopSession!.userId!,
        );
      await audit(tx, req.shopSession!.userId!, 'VARIANT_CREATED', variant.id);
      return variant;
    }),
  });
});
admin.patch('/variants/:id', async (req, res) => {
  const d = z.object({ active: z.boolean() }).strict().parse(req.body);
  res.json({
    data: await atomic(async (tx) => {
      const v = await tx.productVariant.update({ where: { id: id.parse(req.params.id) }, data: d });
      await audit(tx, req.shopSession!.userId!, 'VARIANT_AVAILABILITY_UPDATED', v.id, d);
      return v;
    }),
  });
});

async function adminMutation<T extends { id: string }>(
  req: import('express').Request,
  action: string,
  fn: (tx: import('../services/core.js').Tx) => Promise<T>,
) {
  return atomic(async (tx) => {
    const row = await fn(tx);
    await audit(tx, req.shopSession!.userId!, action, row.id);
    return row;
  });
}
