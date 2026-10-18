import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { storeConfig } from "../config.js";
import { fail, id } from "../services/core.js";
import { requireUser } from "./auth.js";
export function marketContext(req: Request) {
  const marketId = String(req.query.marketId ?? storeConfig.defaultMarketId);
  const market = storeConfig.markets.find(
    (m) => m.id === marketId && m.enabled,
  );
  if (!market) fail(422, "MARKET_INVALID", "This market is not available.");
  const currency = String(req.query.currency ?? market.currency);
  if (currency !== market.currency)
    fail(
      422,
      "CURRENCY_INVALID",
      "Select a configured market for this currency.",
    );
  return { marketId, currency };
}
export const catalog = Router();
catalog.get("/categories", async (_req, res) =>
  res.json({
    data: await prisma.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
  }),
);
catalog.get("/products", async (req, res) => {
  const c = marketContext(req);
  const q = z
    .object({
      q: z.string().max(100).optional(),
      category: z.string().optional(),
      sort: z
        .enum(["featured", "price-asc", "price-desc", "newest"])
        .default("featured"),
      page: z.coerce.number().int().min(1).max(1000).default(1),
      limit: z.coerce.number().int().min(1).max(48).default(24),
    })
    .parse(req.query);
  const products = await prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      category: { active: true, ...(q.category ? { slug: q.category } : {}) },
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: "insensitive" } },
              { description: { contains: q.q, mode: "insensitive" } },
            ],
          }
        : {}),
      variants: { some: { active: true, prices: { some: c } } },
    },
    include: {
      category: true,
      variants: {
        where: { active: true },
        include: { prices: { where: c }, inventory: true },
      },
      reviews: { where: { published: true }, select: { rating: true } },
    },
    orderBy:
      q.sort === "newest" ? { createdAt: "desc" } : { featuredRank: "asc" },
  });
  let data = products.map((p) => ({
    ...p,
    rating: p.reviews.length
      ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length
      : null,
    reviewCount: p.reviews.length,
    variants: p.variants
      .filter((v) => v.prices.length)
      .map((v) => ({
        ...v,
        priceMinor: v.prices[0].amountMinor,
        available: (v.inventory?.onHand ?? 0) - (v.inventory?.allocated ?? 0),
      })),
  }));
  if (q.sort.startsWith("price"))
    data.sort(
      (a, b) =>
        (Number(a.variants[0]?.priceMinor ?? 0) -
          Number(b.variants[0]?.priceMinor ?? 0)) *
        (q.sort === "price-desc" ? -1 : 1),
    );
  const total = data.length;
  data = data.slice((q.page - 1) * q.limit, q.page * q.limit);
  res.json({
    data,
    meta: { total, page: q.page, pages: Math.ceil(total / q.limit) },
  });
});
catalog.get("/products/:slug", async (req, res) => {
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
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });
  if (!p || p.status !== "PUBLISHED" || !p.category.active)
    fail(404, "NOT_FOUND", "This product is unavailable.");
  const variants = p.variants
    .filter((v) => v.prices.length)
    .map((v) => ({
      ...v,
      priceMinor: v.prices[0].amountMinor,
      available: (v.inventory?.onHand ?? 0) - (v.inventory?.allocated ?? 0),
    }));
  if (!variants.length)
    fail(404, "NOT_FOUND", "This product has no price for your market.");
  res.json({
    data: {
      ...p,
      variants,
      rating: p.reviews.length
        ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length
        : null,
      reviewCount: p.reviews.length,
    },
  });
});
catalog.get("/content/:key", async (req, res) =>
  res.json({
    data: await prisma.contentRevision.findFirst({
      where: { key: String(req.params.key), published: true },
      orderBy: { revision: "desc" },
    }),
  }),
);
catalog.post("/order-items/:id/reviews", requireUser, async (req, res) => {
  const item = await prisma.orderItem.findFirst({
    where: {
      id: id.parse(req.params.id),
      order: { userId: req.shopSession!.userId, fulfillment: "DELIVERED" },
    },
    include: { variant: true },
  });
  if (!item)
    fail(403, "FORBIDDEN", "Only delivered purchases can be reviewed.");
  const d = z
    .object({
      rating: z.number().int().min(1).max(5),
      body: z.string().trim().min(10).max(2000),
    })
    .strict()
    .parse(req.body);
  res
    .status(201)
    .json({
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
