import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../src/db/client.js';
import { storeConfig } from '../../src/config.js';
import { productInput } from '../../src/services/products.js';
import { createImageAsset, prepareImage } from '../../src/services/images.js';
import { atomic } from '../../src/services/core.js';

const manifestSchema = z.object({
  notice: z.string(),
  coupons: z.array(
    z.object({
      code: z.string().regex(/^[A-Z0-9_-]{2,30}$/),
      percent: z.number().int().min(1).max(90),
      minimumMinor: z.string().regex(/^\d+$/),
      currency: z.string().length(3),
      maxUses: z.number().int().min(1).max(100000),
    }),
  ),
  pages: z.array(
    z.object({
      key: z.string().regex(/^[a-z-]+$/),
      title: z.string().min(2),
      body: z.string().min(10),
    }),
  ),
  categories: z.array(
    z.object({
      slug: z.string().regex(/^[a-z-]+$/),
      name: z.string().min(2),
      sortOrder: z.number().int(),
    }),
  ),
  products: z.array(
    productInput
      .omit({ categoryId: true, priceMinor: true, version: true })
      .extend({
        categorySlug: z.string(),
        prices: z.record(
          z.string(),
          z.object({ currency: z.string().length(3), amountMinor: z.string().regex(/^\d+$/) }),
        ),
        imageSource: z.url(),
      })
      .omit({ imageUrl: true }),
  ),
});
const file = resolve(process.env.PROJECT_ROOT!, 'backend/prisma/seeds/products.json');
const manifest = manifestSchema.parse(JSON.parse(await readFile(file, 'utf8')));
const defaultMarket = storeConfig.markets.find((m) => m.id === storeConfig.defaultMarketId)!;
const cache = resolve(tmpdir(), 'furniture-commerce-seed-images');
await mkdir(cache, { recursive: true, mode: 0o700 });

async function image(source: string) {
  const u = new URL(source);
  if (u.protocol !== 'https:' || u.hostname !== 'images.unsplash.com')
    throw Error('Seed image source must be an approved HTTPS Unsplash image URL.');
  const path = resolve(cache, createHash('sha256').update(source).digest('hex') + '.jpg');
  let bytes: Buffer;
  try {
    bytes = await readFile(path);
  } catch {
    const response = await fetch(source, {
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
    });
    if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 2 * 1024 * 1024)
      throw Error('Seed image download failed or is too large.');
    const chunks: Uint8Array[] = [];
    let length = 0;
    for await (const chunk of response.body!) {
      length += chunk.length;
      if (length > 2 * 1024 * 1024) throw Error('Seed image exceeds 2 MB.');
      chunks.push(chunk);
    }
    bytes = Buffer.concat(chunks);
    await prepareImage(bytes, 'image/jpeg');
    await writeFile(path, bytes, { mode: 0o600 });
  }
  await prepareImage(bytes, 'image/jpeg');
  return bytes;
}
try {
  // Validate every price book and download every image before changing the database.
  const images = new Map<string, Buffer>();
  for (const product of manifest.products) {
    if (!manifest.categories.some((c) => c.slug === product.categorySlug))
      throw Error('Unknown seed category');
    if (!product.prices[defaultMarket.id])
      throw Error('Seed needs an explicit default-market price book.');
    for (const [marketId, price] of Object.entries(product.prices)) {
      const market = storeConfig.markets.find((m) => m.id === marketId);
      if (!market || market.currency !== price.currency)
        throw Error('Seed price book does not match store configuration.');
      productInput.parse({
        ...Object.fromEntries(
          Object.entries(product).filter(
            ([key]) => !['prices', 'imageSource', 'categorySlug'].includes(key),
          ),
        ),
        categoryId: '00000000-0000-4000-8000-000000000001',
        priceMinor: price.amountMinor,
      });
    }
    if (!images.has(product.imageSource))
      images.set(product.imageSource, await image(product.imageSource));
  }
  if (process.argv.includes('--prepare')) {
    console.log(
      `PASS ${manifest.products.length} validated products and ${images.size} real photographs prepared; database unchanged.`,
    );
  } else {
    let created = 0,
      skipped = 0;
    for (const category of manifest.categories)
      await prisma.category.upsert({
        where: { slug: category.slug },
        create: category,
        update: {},
      });
    for (const product of manifest.products) {
      if (await prisma.product.findUnique({ where: { slug: product.slug } })) {
        skipped++;
        continue;
      }
      const category = await prisma.category.findUniqueOrThrow({
        where: { slug: product.categorySlug },
      });
      const asset = await createImageAsset(
        images.get(product.imageSource)!,
        'image/jpeg',
        `${product.name} — seed photograph`,
      );
      const { prices, categorySlug: _category, imageSource: _source, ...input } = product;
      const data = productInput.parse({
        ...input,
        categoryId: category.id,
        imageUrl: asset.url,
        status: 'PUBLISHED',
        priceMinor: prices[defaultMarket.id].amountMinor,
      });
      const { sku, label, priceMinor: _price, onHand, version: _version, ...fields } = data;
      await atomic(async (tx) => {
        await tx.product.create({
          data: {
            ...fields,
            mediaAssetId: asset.id,
            variants: {
              create: {
                sku,
                label,
                prices: {
                  create: Object.entries(prices).map(([marketId, price]) => ({
                    marketId,
                    currency: price.currency,
                    amountMinor: BigInt(price.amountMinor),
                  })),
                },
                inventory: {
                  create: {
                    onHand,
                    movements: {
                      create: {
                        deltaOnHand: onHand,
                        reason: 'SEED_OPENING_STOCK',
                        eventKey: `seed:${sku}`,
                      },
                    },
                  },
                },
              },
            },
          },
        });
      });
      created++;
      console.log(`Seeded ${product.slug}`);
    }
    for (const coupon of manifest.coupons) {
      if (!storeConfig.currencies.some((c) => c.code === coupon.currency))
        throw Error('Seed coupon currency is not configured.');
      await prisma.coupon.upsert({
        where: { code: coupon.code },
        create: { ...coupon, minimumMinor: BigInt(coupon.minimumMinor) },
        update: {},
      });
    }
    for (const page of manifest.pages)
      await prisma.contentRevision.upsert({
        where: { key_revision: { key: page.key, revision: 1 } },
        create: { ...page, revision: 1, published: true },
        update: {},
      });
    console.log(
      `PASS seed: ${created} created, ${skipped} unchanged; no users, orders or traffic invented. Branch: ${process.env.NEON_BRANCH}.`,
    );
  }
} finally {
  await prisma.$disconnect();
}
