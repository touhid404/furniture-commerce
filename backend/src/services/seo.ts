import type { Request, Response } from 'express';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prisma } from '../db/client.js';
import { storeConfig } from '../config.js';
const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const origin = () => new URL(process.env.PUBLIC_APP_URL ?? 'http://127.0.0.1:3001').origin;
export async function sitemap(_req: Request, res: Response) {
  const products = await prisma.product.findMany({
    where: { status: 'PUBLISHED', category: { active: true } },
    select: { slug: true },
  });
  const paths = [
    '/',
    '/shop',
    '/contact',
    ...['shipping', 'returns', 'privacy', 'terms'].map((k) => `/policies/${k}`),
    ...products.map((p) => `/products/${p.slug}`),
  ];
  res
    .type('xml')
    .send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${esc(origin() + p)}</loc></url>`).join('')}</urlset>`,
    );
}
export function robots(_req: Request, res: Response) {
  res
    .type('text/plain')
    .send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nDisallow: /checkout\nDisallow: /orders/\nDisallow: /api/\nSitemap: ${origin()}/sitemap.xml\n`,
    );
}
export async function storefrontDocument(req: Request, res: Response) {
  const template = await readFile(
    resolve(process.env.PROJECT_ROOT!, 'dist/storefront/index.html'),
    'utf8',
  );
  let title = storeConfig.brand.name + ' — ' + storeConfig.brand.tagline,
    description = storeConfig.brand.tagline,
    body = '',
    structured: unknown = null,
    status = 200;
  const canonical = origin() + req.path;
  const market = storeConfig.markets.find((m) => m.id === storeConfig.defaultMarketId)!;
  const include = {
    variants: {
      where: { active: true },
      include: { prices: { where: { marketId: market.id, currency: market.currency } } },
    },
  };
  if (req.path.startsWith('/products/')) {
    const slug = req.path.split('/')[2],
      p = await prisma.product.findUnique({ where: { slug }, include });
    if (!p || p.status !== 'PUBLISHED') {
      status = 404;
      title = 'Object not found';
    } else {
      title = p.name + ' · ' + storeConfig.brand.name;
      description = p.description;
      const amount = p.variants[0]?.prices[0]?.amountMinor;
      const price =
        amount === undefined
          ? undefined
          : (
              Number(amount) /
              10 **
                (storeConfig.currencies.find((c) => c.code === market.currency)?.minorUnitDigits ??
                  2)
            ).toFixed(2);
      body = `<article><h1>${esc(p.name)}</h1><p>${esc(p.description)}</p><p>${esc(p.materials)}</p><p>${esc(p.dimensions)}</p>${price ? `<p>${esc(market.currency)} ${price}</p>` : ''}</article>`;
      structured = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        description: p.description,
        ...(p.imageUrl ? { image: new URL(p.imageUrl, origin()).href } : {}),
        ...(price
          ? { offers: { '@type': 'Offer', priceCurrency: market.currency, price, url: canonical } }
          : {}),
      };
    }
  } else if (req.path === '/' || req.path === '/shop') {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const products = await prisma.product.findMany({
      where: {
        status: 'PUBLISHED',
        category: { active: true, ...(category ? { slug: category } : {}) },
      },
      select: { name: true, slug: true, description: true },
      orderBy: { featuredRank: 'asc' },
      take: 24,
    });
    title = req.path === '/' ? title : 'The collection · ' + storeConfig.brand.name;
    body = `<h1>${esc(req.path === '/' ? storeConfig.home.headline : 'The collection')}</h1><p>${esc(description)}</p><ul>${products.map((p) => `<li><a href="/products/${esc(p.slug)}">${esc(p.name)}</a><p>${esc(p.description)}</p></li>`).join('')}</ul>`;
  } else if (req.path.startsWith('/policies/')) {
    const content = await prisma.contentRevision.findFirst({
      where: { key: req.path.split('/')[2], published: true },
      orderBy: { revision: 'desc' },
    });
    if (content) {
      title = content.title + ' · ' + storeConfig.brand.name;
      description = content.body.slice(0, 200);
      body = `<article><h1>${esc(content.title)}</h1><p>${esc(content.body)}</p></article>`;
    } else status = 404;
  } else if (req.path === '/contact') {
    body = `<h1>Contact ${esc(storeConfig.brand.name)}</h1><p>${esc(storeConfig.brand.supportEmail)}</p>`;
  } else if (
    !/^\/(admin|account|sign-in|bag|checkout|orders|forgot-password|reset-password|verify-email|order-access)(\/|$)/.test(
      req.path,
    )
  )
    status = 404;
  const privatePage = !body;
  const metadata = `<meta name="description" content="${esc(description.slice(0, 300))}"><meta name="robots" content="${privatePage || status === 404 ? 'noindex, nofollow' : 'index, follow'}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description.slice(0, 200))}">${structured ? `<script type="application/ld+json">${JSON.stringify(structured).replaceAll('<', '\\u003c')}</script>` : ''}`;
  const snapshot = body
    ? `<div class="seo-snapshot"><a href="/">${esc(storeConfig.brand.name)}</a>${body}<p>The interactive store is loading. Please enable JavaScript to shop.</p></div>`
    : '';
  res
    .status(status)
    .type('html')
    .send(
      template
        .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
        .replace('</head>', metadata + '</head>')
        .replace('<div id="root"></div>', `<div id="root">${snapshot}</div>`),
    );
}
