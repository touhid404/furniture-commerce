import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client.js";
import { storeConfig } from "../config.js";
import { requireAdmin } from "./auth.js";
import {
  audit,
  atomic,
  csvCell,
  event,
  fail,
  id,
  json,
  lockOrder,
  moveStock,
  safeUrl,
} from "../services/core.js";
import { cancelOrder } from "./commerce.js";
export const admin = Router();
admin.use(requireAdmin);
admin.use((req, _res, next) => {
  if (storeConfig.mode === "production" && !req.shopSession!.user!.totpSecret)
    fail(
      403,
      "MFA_ENROLLMENT_REQUIRED",
      "Enable administrator MFA in account settings before operating this production store.",
    );
  next();
});
const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
admin.get("/dashboard", async (req, res) => {
  const range = z
    .enum(["7d", "30d", "90d"])
    .catch("30d")
    .parse(req.query.range);
  const currency = String(req.query.currency ?? storeConfig.currencies[0].code);
  if (!storeConfig.currencies.some((c) => c.code === currency))
    fail(422, "CURRENCY_INVALID", "Unknown currency.");
  const days = Number(range.slice(0, -1));
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const prior = new Date(start.getTime() - days * 86400000);
  const orders = await prisma.order.findMany({
    where: { currency, createdAt: { gte: prior } },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  const current = orders.filter(
    (o) => o.createdAt >= start && o.status !== "CANCELLED",
  );
  const previous = orders.filter(
    (o) => o.createdAt < start && o.status !== "CANCELLED",
  );
  const summarize = (list: typeof orders) => ({
    revenue: list.reduce(
      (s, o) =>
        s +
        (o.paymentStatus === "PAID" ||
        o.paymentStatus === "PARTIALLY_REFUNDED" ||
        o.paymentStatus === "REFUNDED"
          ? Number(
              o.totalMinor - o.shippingMinor - o.taxMinor - o.refundedMinor,
            )
          : 0),
      0,
    ),
    orders: list.length,
    aov: list.length
      ? Math.round(
          list.reduce(
            (s, o) => s + Number(o.subtotalMinor - o.discountMinor),
            0,
          ) / list.length,
        )
      : 0,
    customers: new Set(list.map((o) => o.userId ?? o.email)).size,
  });
  const metrics = summarize(current);
  const comparison = summarize(previous);
  const series = Array.from({ length: days }, (_, i) => {
    const from = new Date(start.getTime() + i * 86400000),
      to = new Date(from.getTime() + 86400000);
    return {
      date: from.toISOString(),
      ...summarize(
        current.filter((o) => o.createdAt >= from && o.createdAt < to),
      ),
    };
  });
  const categories: Record<string, number> = {};
  for (const o of current.filter(
    (o) =>
      o.paymentStatus === "PAID" || o.paymentStatus === "PARTIALLY_REFUNDED",
  ))
    for (const i of o.items)
      categories[i.category] =
        (categories[i.category] ?? 0) +
        Number(i.lineTotalMinor) *
          (Number(o.totalMinor - o.refundedMinor) /
            Math.max(1, Number(o.totalMinor)));
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: storeConfig.timezone,
  }).format(end);
  const today = current.filter(
    (o) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: storeConfig.timezone,
      }).format(o.createdAt) === todayKey,
  );
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
      today: summarize(today),
      goalMinor: storeConfig.dashboard.dailyGoalByCurrency[currency] ?? 0,
      recent: current.slice(0, 12),
    },
  });
});
admin.get("/orders", async (req, res) => {
  const q = pagination
    .extend({
      q: z.string().max(100).optional(),
      status: z
        .enum(["CONFIRMED", "PROCESSING", "COMPLETED", "CANCELLED"])
        .optional(),
    })
    .parse(req.query);
  const where = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.q
      ? {
          OR: [
            { number: { contains: q.q, mode: "insensitive" as const } },
            { email: { contains: q.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true, shipment: true },
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.order.count({ where }),
  ]);
  res.json({
    data,
    meta: { total, page: q.page, pages: Math.ceil(total / q.limit) },
  });
});
admin.get("/orders/:id", async (req, res) => {
  const o = await prisma.order.findUnique({
    where: { id: id.parse(req.params.id) },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
      shipment: true,
      returns: true,
      refunds: true,
      user: { select: { name: true } },
    },
  });
  if (!o) fail(404, "NOT_FOUND", "Order not found.");
  res.json({ data: o });
});
admin.post("/orders/:id/processing", async (req, res) =>
  res.json({
    data: await atomic(async (tx) => {
      const o = await lockOrder(tx, id.parse(req.params.id));
      if (!o || o.status === "CANCELLED" || o.shipment)
        fail(409, "STATE_CONFLICT", "This order cannot be processed.");
      await event(
        tx,
        o.id,
        "PROCESSING",
        "The store is preparing your order.",
        req.shopSession!.userId!,
      );
      return tx.order.update({
        where: { id: o.id },
        data: {
          status: "PROCESSING",
          fulfillment: "PROCESSING",
          version: { increment: 1 },
        },
      });
    }),
  }),
);
admin.post("/orders/:id/cancellations", async (req, res) =>
  res.json({ data: await cancelOrder(req, id.parse(req.params.id), true) }),
);
admin.post("/orders/:id/shipments", async (req, res) => {
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
      if (!o || o.status === "CANCELLED" || o.shipment)
        fail(409, "STATE_CONFLICT", "This order cannot be shipped.");
      for (const i of o.items)
        await moveStock(
          tx,
          i.variantId,
          -i.quantity,
          -i.quantity,
          "SHIPPED",
          `${o.id}:${i.variantId}:ship`,
          req.shopSession!.userId!,
        );
      await tx.shipment.create({ data: { orderId: o.id, ...d } });
      await event(
        tx,
        o.id,
        "SHIPPED",
        `Shipped with ${d.carrier}. Tracking: ${d.tracking}`,
        req.shopSession!.userId!,
      );
      await audit(tx, req.shopSession!.userId!, "ORDER_SHIPPED", o.id, d);
      return tx.order.update({
        where: { id: o.id },
        data: {
          fulfillment: "SHIPPED",
          status: "PROCESSING",
          version: { increment: 1 },
        },
      });
    }),
  });
});
admin.post("/orders/:id/delivery", async (req, res) =>
  res.json({
    data: await atomic(async (tx) => {
      const o = await lockOrder(tx, id.parse(req.params.id));
      if (!o?.shipment || o.fulfillment !== "SHIPPED")
        fail(409, "STATE_CONFLICT", "Only shipped orders can be delivered.");
      await tx.shipment.update({
        where: { orderId: o.id },
        data: { deliveredAt: new Date() },
      });
      await event(
        tx,
        o.id,
        "DELIVERED",
        "Your order has been delivered.",
        req.shopSession!.userId!,
      );
      return tx.order.update({
        where: { id: o.id },
        data: {
          fulfillment: "DELIVERED",
          status: "COMPLETED",
          version: { increment: 1 },
        },
      });
    }),
  }),
);
admin.post("/orders/:id/cod-collections", async (req, res) =>
  res.json({
    data: await atomic(async (tx) => {
      const o = await lockOrder(tx, id.parse(req.params.id));
      if (!o || o.fulfillment !== "DELIVERED" || o.paymentStatus !== "UNPAID")
        fail(
          409,
          "STATE_CONFLICT",
          "Only delivered unpaid COD orders can be collected.",
        );
      await event(
        tx,
        o.id,
        "COD_COLLECTED",
        "Cash payment collected on delivery.",
        req.shopSession!.userId!,
      );
      await audit(tx, req.shopSession!.userId!, "COD_COLLECTED", o.id);
      return tx.order.update({
        where: { id: o.id },
        data: { paymentStatus: "PAID", version: { increment: 1 } },
      });
    }),
  }),
);
admin.post("/orders/:id/refunds", async (req, res) => {
  const d = z
    .object({
      amountMinor: z.coerce.bigint().positive(),
      reason: z.string().trim().min(5).max(1000),
      reference: z.string().trim().min(3).max(100),
    })
    .strict()
    .parse(req.body);
  const key = z.string().min(16).max(128).parse(req.get("Idempotency-Key"));
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
          old.reference !== d.reference
        )
          fail(
            409,
            "IDEMPOTENCY_CONFLICT",
            "This refund key was used for another request.",
          );
        return old;
      }
      const o = await lockOrder(tx, orderId);
      if (
        !o ||
        !["PAID", "PARTIALLY_REFUNDED"].includes(o.paymentStatus) ||
        o.refundedMinor + d.amountMinor > o.totalMinor
      )
        fail(
          422,
          "REFUND_INVALID",
          "Refund exceeds the collected unrefunded balance.",
        );
      const refunded = o.refundedMinor + d.amountMinor;
      const r = await tx.refund.create({
        data: { orderId: o.id, ...d, idempotencyKey: key },
      });
      await tx.order.update({
        where: { id: o.id },
        data: {
          refundedMinor: refunded,
          paymentStatus:
            refunded === o.totalMinor ? "REFUNDED" : "PARTIALLY_REFUNDED",
          version: { increment: 1 },
        },
      });
      await event(
        tx,
        o.id,
        "MANUAL_REFUND",
        `Manual COD refund recorded. Reference: ${d.reference}`,
        req.shopSession!.userId!,
      );
      await audit(tx, req.shopSession!.userId!, "MANUAL_REFUND", o.id, {
        ...d,
        amountMinor: d.amountMinor.toString(),
      });
      return r;
    }),
  });
});
const productInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .max(120),
    categoryId: id,
    description: z.string().min(10).max(5000),
    materials: z.string().max(2000).default(""),
    dimensions: z.string().max(500).default(""),
    care: z.string().max(1000).default(""),
    art: z
      .enum(["chair", "lamp", "pendant", "table", "sofa", "vase", "textile"])
      .default("chair"),
    color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    background: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    badge: z.string().max(30).default(""),
    imageUrl: safeUrl.default(""),
    featuredRank: z.number().int().min(0).max(1000).default(0),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
    sku: z.string().trim().min(2).max(60),
    label: z.string().max(100).default("Standard"),
    priceMinor: z.coerce.bigint().min(0n).max(1000000000000n),
    onHand: z.number().int().min(0).max(100000),
    version: z.number().int().optional(),
  })
  .strict();
admin.get("/products", async (req, res) => {
  const q = z.string().max(100).catch("").parse(req.query.q);
  res.json({
    data: await prisma.product.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : {},
      include: {
        category: true,
        variants: { include: { prices: true, inventory: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  });
});
admin.get("/products/:id", async (req, res) => {
  const p = await prisma.product.findUnique({
    where: { id: id.parse(req.params.id) },
    include: {
      category: true,
      variants: { include: { prices: true, inventory: true } },
    },
  });
  if (!p) fail(404, "NOT_FOUND", "Product not found.");
  res.json({ data: p });
});
admin.post("/products", async (req, res) => {
  const d = productInput.parse(req.body);
  const { sku, label, priceMinor, onHand, version: _version, ...data } = d;
  const m = storeConfig.markets.find(
    (x) => x.id === storeConfig.defaultMarketId,
  )!;
  res.status(201).json({
    data: await atomic(async (tx) => {
      const p = await tx.product.create({
        data: {
          ...data,
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
              inventory: { create: { onHand } },
            },
          },
        },
        include: { variants: true },
      });
      await audit(tx, req.shopSession!.userId!, "PRODUCT_CREATED", p.id);
      return p;
    }),
  });
});
admin.patch("/products/:id", async (req, res) => {
  const d = productInput.parse(req.body);
  const { sku, label, priceMinor, onHand, version, ...data } = d;
  const m = storeConfig.markets.find(
    (x) => x.id === storeConfig.defaultMarketId,
  )!;
  res.json({
    data: await atomic(async (tx) => {
      const productId = id.parse(req.params.id);
      const p = await tx.product.findUnique({
        where: { id: productId },
        include: { variants: { include: { inventory: true } } },
      });
      if (!p) fail(404, "NOT_FOUND", "Product not found.");
      if (version !== p.version)
        fail(
          409,
          "VERSION_CONFLICT",
          "Another edit changed this product. Reload it first.",
        );
      const v = p.variants[0];
      if (!v)
        fail(409, "VARIANT_REQUIRED", "Create a purchasable variant first.");
      await tx.product.update({
        where: { id: p.id },
        data: { ...data, version: { increment: 1 } },
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
          "PRODUCT_STOCK_EDIT",
          randomUUID(),
          req.shopSession!.userId!,
        );
      await audit(tx, req.shopSession!.userId!, "PRODUCT_UPDATED", p.id, {
        version: p.version + 1,
      });
      return tx.product.findUnique({
        where: { id: p.id },
        include: { variants: { include: { prices: true, inventory: true } } },
      });
    }),
  });
});
admin.post("/products/:id/archive", async (req, res) =>
  res.json({
    data: await atomic(async (tx) => {
      const p = await tx.product.update({
        where: { id: id.parse(req.params.id) },
        data: { status: "ARCHIVED", version: { increment: 1 } },
      });
      await audit(tx, req.shopSession!.userId!, "PRODUCT_ARCHIVED", p.id);
      return p;
    }),
  }),
);
admin.get("/categories", async (_req, res) =>
  res.json({
    data: await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { sortOrder: "asc" },
    }),
  }),
);
const catInput = z
  .object({
    name: z.string().min(2).max(80),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(80),
    description: z.string().max(1000).default(""),
    sortOrder: z.number().int().min(0).max(1000).default(0),
    active: z.boolean().default(true),
  })
  .strict();
admin.post("/categories", async (req, res) =>
  res
    .status(201)
    .json({
      data: await prisma.category.create({ data: catInput.parse(req.body) }),
    }),
);
admin.patch("/categories/:id", async (req, res) =>
  res.json({
    data: await prisma.category.update({
      where: { id: id.parse(req.params.id) },
      data: catInput.parse(req.body),
    }),
  }),
);
admin.delete("/categories/:id", async (req, res) => {
  const categoryId = id.parse(req.params.id);
  if (await prisma.product.count({ where: { categoryId } }))
    fail(
      409,
      "CATEGORY_IN_USE",
      "Reassign products before removing this category.",
    );
  await prisma.category.delete({ where: { id: categoryId } });
  res.json({ data: { ok: true } });
});
admin.get("/inventory", async (_req, res) =>
  res.json({
    data: await prisma.inventory.findMany({
      include: {
        variant: { include: { product: true } },
        movements: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { onHand: "asc" },
      take: 200,
    }),
  }),
);
admin.post("/inventory/:id/adjustments", async (req, res) => {
  const d = z
    .object({
      delta: z.number().int().min(-10000).max(10000),
      reason: z.string().trim().min(5).max(200),
      version: z.number().int(),
    })
    .strict()
    .parse(req.body);
  await atomic(async (tx) => {
    const i = await tx.inventory.findUnique({
      where: { id: id.parse(req.params.id) },
    });
    if (!i) fail(404, "NOT_FOUND", "Inventory record not found.");
    if (i.version !== d.version)
      fail(
        409,
        "VERSION_CONFLICT",
        "Stock changed. Refresh before adjusting it.",
      );
    await moveStock(
      tx,
      i.variantId,
      d.delta,
      0,
      d.reason,
      randomUUID(),
      req.shopSession!.userId!,
    );
    await audit(tx, req.shopSession!.userId!, "STOCK_ADJUSTED", i.id, d);
  });
  res.json({ data: { ok: true } });
});
admin.get("/returns", async (_req, res) =>
  res.json({
    data: await prisma.returnRequest.findMany({
      include: { order: { include: { items: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  }),
);
admin.post("/returns/:id/decisions", async (req, res) => {
  const d = z
    .object({
      status: z.enum(["APPROVED", "REJECTED"]),
      resolution: z.string().min(3).max(1000),
    })
    .parse(req.body);
  res.json({
    data: await atomic(async (tx) => {
      const r = await tx.returnRequest.findUnique({
        where: { id: id.parse(req.params.id) },
      });
      if (!r) fail(404, "NOT_FOUND", "Return not found.");
      await lockOrder(tx, r.orderId);
      if (r.status !== "REQUESTED")
        fail(409, "STATE_CONFLICT", "This return has already been reviewed.");
      await event(
        tx,
        r.orderId,
        `RETURN_${d.status}`,
        d.resolution,
        req.shopSession!.userId!,
      );
      return tx.returnRequest.update({ where: { id: r.id }, data: d });
    }),
  });
});
admin.post("/returns/:id/receipts", async (req, res) => {
  const d = z
    .object({ restock: z.boolean(), resolution: z.string().min(3).max(1000) })
    .parse(req.body);
  res.json({
    data: await atomic(async (tx) => {
      const r = await tx.returnRequest.findUnique({
        where: { id: id.parse(req.params.id) },
      });
      if (!r) fail(404, "NOT_FOUND", "Return not found.");
      const o = await lockOrder(tx, r.orderId);
      const latest = await tx.returnRequest.findUniqueOrThrow({
        where: { id: r.id },
      });
      if (latest.status !== "APPROVED" || !o)
        fail(409, "STATE_CONFLICT", "Only approved returns can be received.");
      const items = z
        .array(
          z.object({ orderItemId: id, quantity: z.number().int().positive() }),
        )
        .parse(r.items);
      for (const line of items) {
        const i = o.items.find((x) => x.id === line.orderItemId);
        if (!i || line.quantity > i.quantity - i.returnedQuantity)
          fail(409, "RETURN_INELIGIBLE", "Return quantity changed.");
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
            "RETURN_RECEIVED",
            `${r.id}:${i.id}:restock`,
            req.shopSession!.userId!,
          );
      }
      await event(
        tx,
        o.id,
        "RETURN_RECEIVED",
        "Returned items received and inspected.",
        req.shopSession!.userId!,
      );
      return tx.returnRequest.update({
        where: { id: r.id },
        data: { status: "RECEIVED", resolution: d.resolution },
      });
    }),
  });
});
admin.get("/reviews", async (_req, res) =>
  res.json({
    data: await prisma.review.findMany({
      include: {
        product: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  }),
);
admin.patch("/reviews/:id", async (req, res) =>
  res.json({
    data: await prisma.review.update({
      where: { id: id.parse(req.params.id) },
      data: z.object({ published: z.boolean() }).strict().parse(req.body),
    }),
  }),
);
admin.get("/coupons", async (_req, res) =>
  res.json({
    data: await prisma.coupon.findMany({ orderBy: { code: "asc" } }),
  }),
);
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
admin.post("/coupons", async (req, res) =>
  res
    .status(201)
    .json({
      data: await prisma.coupon.create({ data: couponInput.parse(req.body) }),
    }),
);
admin.patch("/coupons/:id", async (req, res) =>
  res.json({
    data: await prisma.coupon.update({
      where: { id: id.parse(req.params.id) },
      data: couponInput.parse(req.body),
    }),
  }),
);
admin.get("/content", async (_req, res) =>
  res.json({
    data: await prisma.contentRevision.findMany({
      orderBy: [{ key: "asc" }, { revision: "desc" }],
      take: 100,
    }),
  }),
);
admin.post("/content", async (req, res) => {
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
        orderBy: { revision: "desc" },
      });
      return tx.contentRevision.create({
        data: { ...d, revision: (old?.revision ?? 0) + 1 },
      });
    }),
  });
});
admin.post("/content/:id/publish", async (req, res) =>
  res.json({
    data: await atomic(async (tx) => {
      const revision = await tx.contentRevision.findUnique({
        where: { id: id.parse(req.params.id) },
      });
      if (!revision) fail(404, "NOT_FOUND", "Content revision not found.");
      await tx.contentRevision.updateMany({
        where: { key: revision.key },
        data: { published: false },
      });
      await audit(
        tx,
        req.shopSession!.userId!,
        "CONTENT_PUBLISHED",
        revision.id,
      );
      return tx.contentRevision.update({
        where: { id: revision.id },
        data: { published: true },
      });
    }),
  }),
);
admin.get("/config", (_req, res) =>
  res.json({
    data: {
      config: storeConfig,
      integrations: {
        email: !!process.env.SMTP_HOST,
        payment: "COMING_SOON",
        databaseBranch: process.env.NEON_BRANCH,
      },
      message:
        "Store variables are managed in versioned JSON. Credentials are environment-only.",
    },
  }),
);
admin.get("/audit", async (_req, res) =>
  res.json({
    data: await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  }),
);
admin.get("/notifications", async (_req, res) => {
  const jobs = await prisma.outboxJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({
    data: jobs.map((j) => ({
      ...j,
      payload: storeConfig.mode === "demo" ? j.payload : { redacted: true },
    })),
  });
});
admin.get("/exports/orders", async (req, res) => {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 10000,
  });
  await prisma.auditLog.create({
    data: {
      actorId: req.shopSession!.userId,
      action: "ORDERS_EXPORTED",
      target: "orders",
      details: { count: orders.length },
    },
  });
  res
    .type("text/csv")
    .attachment("orders.csv")
    .send(
      [
        [
          "Order",
          "Date",
          "Email",
          "Status",
          "Payment",
          "Currency",
          "Total minor units",
        ]
          .map(csvCell)
          .join(","),
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
            .join(","),
        ),
      ].join("\n"),
    );
});
