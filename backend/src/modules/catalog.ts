import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { storeConfig } from '../config.js';
import { fail, id } from '../services/core.js';
import { requireUser } from './auth.js';
export function marketContext(req: Request) {
  const marketId = String(req.query.marketId ?? storeConfig.defaultMarketId);
  const market = storeConfig.markets.find((m) => m.id === marketId && m.enabled);
  if (!market) fail(422, 'MARKET_INVALID', 'This market is not available.');
  const currency = String(req.query.currency ?? market.currency);
  if (currency !== market.currency)
    fail(422, 'CURRENCY_INVALID', 'Select a configured market for this currency.');
  return { marketId, currency };
}
export const catalog = Router();
catalog.get('/categories', async (_req, res) =>
  res.json({
    data: await prisma.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    }),
  }),
);
catalog.get('/products', async (req, res) => {
  const c = marketContext(req);
  const q = z
    .object({
      q: z.string().max(100).optional(),
      category: z.string().max(100).optional(),
      sort: z.enum(['featured', 'price-asc', 'price-desc', 'newest']).default('featured'),
      page: z.coerce.number().int().min(1).max(1000).default(1),
      limit: z.coerce.number().int().min(1).max(48).default(24),
      minPriceMinor: z.coerce.bigint().nonnegative().optional(),
      maxPriceMinor: z.coerce.bigint().nonnegative().optional(),
      availability: z.enum(['all', 'in-stock']).default('all'),
    })
    .parse(req.query);
  const filtered = Prisma.sql`SELECT p.id, MIN(pr."amountMinor") AS min_price,p."featuredRank",p."createdAt" FROM "Product" p JOIN "Category" c ON c.id=p."categoryId" JOIN "ProductVariant" v ON v."productId"=p.id JOIN "Price" pr ON pr."variantId"=v.id LEFT JOIN "Inventory" i ON i."variantId"=v.id WHERE p.status='PUBLISHED' AND c.active=true AND v.active=true AND pr."marketId"=${c.marketId} AND pr.currency=${c.currency} ${q.category ? Prisma.sql`AND c.slug=${q.category}` : Prisma.empty} ${q.q ? Prisma.sql`AND (p.name ILIKE ${'%' + q.q + '%'} OR p.description ILIKE ${'%' + q.q + '%'})` : Prisma.empty} ${q.availability === 'in-stock' ? Prisma.sql`AND i."onHand">i.allocated` : Prisma.empty} GROUP BY p.id HAVING MIN(pr."amountMinor")>=${q.minPriceMinor ?? 0n} ${q.maxPriceMinor !== undefined ? Prisma.sql`AND MIN(pr."amountMinor")<=${q.maxPriceMinor}` : Prisma.empty}`;
  const order =
    q.sort === 'price-asc'
      ? Prisma.sql`min_price ASC,id`
      : q.sort === 'price-desc'
        ? Prisma.sql`min_price DESC,id`
        : q.sort === 'newest'
          ? Prisma.sql`"createdAt" DESC,id`
          : Prisma.sql`"featuredRank" ASC,id`;
  const [ids, count] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM (${filtered}) listed ORDER BY ${order} LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
    ),
    prisma.$queryRaw<{ total: bigint }[]>(
      Prisma.sql`SELECT COUNT(*) AS total FROM (${filtered}) listed`,
    ),
  ]);
  const products = await prisma.product.findMany({
    where: { id: { in: ids.map((p) => p.id) } },
    include: {
      category: true,
      variants: { where: { active: true }, include: { prices: { where: c }, inventory: true } },
    },
  });
  const ratings = await prisma.review.groupBy({
    by: ['productId'],
    where: { published: true, productId: { in: ids.map((p) => p.id) } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const data = ids.map(({ id }) => {
    const p = products.find((p) => p.id === id)!,
      rating = ratings.find((r) => r.productId === id);
    return {
      ...p,
      rating: rating ? rating._avg.rating : null,
      reviewCount: rating ? rating._count.rating : 0,
      variants: p.variants
        .filter((v) => v.prices.length)
        .map((v) => ({
          id: v.id,
          sku: v.sku,
          label: v.label,
          active: v.active,
          priceMinor: v.prices[0].amountMinor,
          available: (v.inventory?.onHand ?? 0) - (v.inventory?.allocated ?? 0),
        }))
        .sort((a, b) => Number(a.priceMinor - b.priceMinor)),
    };
  });
  const total = Number(count[0].total);
  res.json({ data, meta: { total, page: q.page, pages: Math.ceil(total / q.limit) } });
});
catalog.get('/products/:slug', async (req, res) => {
  const c = marketContext(req);
  const p = await prisma.product.findUnique({
    where: { slug: String(req.params.slug) },
    include: {
      category: true,
      variants: {
        where: { active: true },
        include: { prices: { where: c }, inventory: true },
      },
      reviews: {
        where: { published: true },
        select: {
          id: true,
          rating: true,
          body: true,
          createdAt: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      },
    },
  });
  if (!p || p.status !== 'PUBLISHED' || !p.category.active)
    fail(404, 'NOT_FOUND', 'This product is unavailable.');
  const variants = p.variants
    .filter((v) => v.prices.length)
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      label: v.label,
      active: v.active,
      priceMinor: v.prices[0].amountMinor,
      available: (v.inventory?.onHand ?? 0) - (v.inventory?.allocated ?? 0),
    }));
  if (!variants.length) fail(404, 'NOT_FOUND', 'This product has no price for your market.');
  const rating = await prisma.review.aggregate({
    where: { productId: p.id, published: true },
    _avg: { rating: true },
    _count: { rating: true },
  });
  res.json({
    data: {
      ...p,
      variants,
      rating: rating._avg.rating,
      reviewCount: rating._count.rating,
    },
  });
});
catalog.get('/content/:key', async (req, res) =>
  res.json({
    data: await prisma.contentRevision.findFirst({
      where: { key: String(req.params.key), published: true },
      orderBy: { revision: 'desc' },
    }),
  }),
);
catalog.post('/order-items/:id/reviews', requireUser, async (req, res) => {
  const item = await prisma.orderItem.findFirst({
    where: {
      id: id.parse(req.params.id),
      order: { userId: req.shopSession!.userId, fulfillment: 'DELIVERED' },
    },
    include: { variant: true },
  });
  if (!item) fail(403, 'FORBIDDEN', 'Only delivered purchases can be reviewed.');
  const d = z
    .object({
      rating: z.number().int().min(1).max(5),
      body: z.string().trim().min(10).max(2000),
    })
    .strict()
    .parse(req.body);
  res.status(201).json({
    data: await prisma.review.create({
      data: {
        ...d,
        productId: item.variant.productId,
        orderItemId: item.id,
        userId: req.shopSession!.userId!,
      },
    }),
  });
});
