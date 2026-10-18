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
      search: z.string().max(100).optional(),
      category: z.string().max(100).optional(),
      sort: z.enum(['featured', 'price-asc', 'price-desc', 'newest']).default('featured'),
      page: z.coerce.number().int().min(1).max(1000).default(1),
      limit: z.coerce.number().int().min(1).max(48).default(12),
      minPriceMinor: z.coerce.bigint().nonnegative().optional(),
      maxPriceMinor: z.coerce.bigint().nonnegative().optional(),
      availability: z.enum(['all', 'in-stock']).default('all'),
    })
    .parse(req.query);
  const term = q.search ?? q.q;
  const filtered = Prisma.sql`SELECT p.id, MIN(pr."amountMinor") AS min_price,p."featuredRank",p."createdAt" FROM "Product" p JOIN "Category" c ON c.id=p."categoryId" JOIN "ProductVariant" v ON v."productId"=p.id JOIN "Price" pr ON pr."variantId"=v.id LEFT JOIN "Inventory" i ON i."variantId"=v.id WHERE p.status='PUBLISHED' AND c.active=true AND v.active=true AND pr."marketId"=${c.marketId} AND pr.currency=${c.currency} ${q.category ? Prisma.sql`AND c.slug=${q.category}` : Prisma.empty} ${term ? Prisma.sql`AND (p.name ILIKE ${'%' + term + '%'} OR p.description ILIKE ${'%' + term + '%'})` : Prisma.empty} ${q.availability === 'in-stock' ? Prisma.sql`AND i."onHand">i.allocated` : Prisma.empty} GROUP BY p.id HAVING MIN(pr."amountMinor")>=${q.minPriceMinor ?? 0n} ${q.maxPriceMinor !== undefined ? Prisma.sql`AND MIN(pr."amountMinor")<=${q.maxPriceMinor}` : Prisma.empty}`;
  const order =
    q.sort === 'price-asc'
      ? Prisma.sql`min_price ASC,id`
      : q.sort === 'price-desc'
        ? Prisma.sql`min_price DESC,id`
        : q.sort === 'newest'
          ? Prisma.sql`"createdAt" DESC,id`
          : Prisma.sql`"featuredRank" ASC,id`;
  // One database round trip, with details/reviews left out of listing payloads.
  const [result] = await prisma.$queryRaw<{ data: unknown[]; total: bigint }[]>(Prisma.sql`
    WITH eligible AS (${filtered}),
    page AS (SELECT id, row_number() OVER (ORDER BY ${order}) AS position FROM eligible ORDER BY ${order} LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}),
    cards AS (
      SELECT page.position, jsonb_build_object(
        'id',p.id,'name',p.name,'slug',p.slug,'imageUrl',p."imageUrl",'art',p.art,'color',p.color,'background',p.background,'badge',p.badge,'status',p.status,
        'category',jsonb_build_object('id',c.id,'name',c.name,'slug',c.slug),
        'variants',(SELECT jsonb_agg(jsonb_build_object('id',v.id,'sku',v.sku,'label',v.label,'active',v.active,'priceMinor',pr."amountMinor"::text,'available',GREATEST(0,COALESCE(i."onHand"-i.allocated,0))) ORDER BY pr."amountMinor",v.id)
          FROM "ProductVariant" v JOIN "Price" pr ON pr."variantId"=v.id LEFT JOIN "Inventory" i ON i."variantId"=v.id WHERE v."productId"=p.id AND v.active AND pr."marketId"=${c.marketId} AND pr.currency=${c.currency}),
        'rating',(SELECT avg(r.rating) FROM "Review" r WHERE r."productId"=p.id AND r.published),
        'reviewCount',(SELECT count(*) FROM "Review" r WHERE r."productId"=p.id AND r.published)
      ) AS card FROM page JOIN "Product" p ON p.id=page.id JOIN "Category" c ON c.id=p."categoryId"
    ) SELECT COALESCE((SELECT jsonb_agg(card ORDER BY position) FROM cards),'[]'::jsonb) AS data, (SELECT count(*) FROM eligible) AS total
  `);
  const total = Number(result.total),
    pages = Math.ceil(total / q.limit);
  res.json({
    data: result.data,
    meta: {
      total,
      totalItems: total,
      page: q.page,
      currentPage: q.page,
      limit: q.limit,
      pages,
      totalPages: pages,
      hasNextPage: q.page < pages,
    },
  });
});
catalog.get('/product-prices', async (req, res) => {
  const context = marketContext(req);
  const ids = z
    .string()
    .max(8000)
    .transform((s) => s.split(',').filter(Boolean))
    .pipe(z.array(id).max(200))
    .parse(req.query.ids);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      active: true,
      prices: { where: context, select: { amountMinor: true } },
      inventory: { select: { onHand: true, allocated: true } },
      product: { select: { status: true, category: { select: { active: true } } } },
    },
  });
  res.json({
    data: variants.map((v) => ({
      variantId: v.id,
      unitPriceMinor: v.prices[0]?.amountMinor ?? 0n,
      available: Math.max(0, (v.inventory?.onHand ?? 0) - (v.inventory?.allocated ?? 0)),
      purchasable:
        v.active &&
        v.product.status === 'PUBLISHED' &&
        v.product.category.active &&
        v.prices.length > 0,
    })),
  });
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
