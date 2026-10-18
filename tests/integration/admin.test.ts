import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { app } from '../../backend/src/app.js';
import { prisma } from '../../backend/src/db/client.js';
import { applyStoreConfig } from '../../backend/src/config.js';
import { refreshStoreSettings } from '../../backend/src/services/store-settings.js';
import { assertFixtureEnvironment } from '../fixtures/environment.js';
assertFixtureEnvironment();
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string') throw Error('No server');
const base = `http://127.0.0.1:${address.port}/api/v1`;
function client() {
  let cookie = '',
    csrf = '';
  return async (path: string, method = 'GET', input?: unknown) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        Cookie: cookie,
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...(input ? { 'Content-Type': 'application/json' } : {}),
      },
      body: input ? JSON.stringify(input) : undefined,
    });
    const header = response.headers.getSetCookie()[0];
    if (header) cookie = header.split(';')[0];
    const body = await response.json();
    if (body.data?.csrfToken) csrf = body.data.csrfToken;
    return { status: response.status, ...body };
  };
}
try {
  await test(
    'all admin API methods deny guests and authenticated customers before handlers',
    { timeout: 180000 },
    async () => {
      const guest = client(),
        customer = client();
      await guest('/auth/csrf');
      await customer('/auth/csrf');
      const registration = await customer('/auth/register', 'POST', {
        name: 'Authorization Customer',
        email: `admin-denial-${randomUUID()}@example.invalid`,
        password: 'Customer-password-123!',
        role: 'ADMIN',
      });
      assert.equal(registration.data.user.role, 'CUSTOMER');
      const routes = ['admin.ts', 'media.ts'].flatMap((file) => {
        const source = readFileSync(`backend/src/modules/${file}`, 'utf8');
        const router = file === 'admin.ts' ? 'admin' : 'media',
          prefix = file === 'admin.ts' ? '/admin' : '/admin/media';
        return Array.from(
          source.matchAll(
            new RegExp(`\\b${router}\\.(get|post|put|patch|delete)\\(\\s*['"]([^'"]+)['"]`, 'g'),
          ),
          (match) => ({
            method: match[1].toUpperCase(),
            path: prefix + (match[2] === '/' ? '' : match[2]).replace(/:id/g, randomUUID()),
          }),
        );
      });
      assert.ok(routes.length >= 35);
      for (const request of [guest, customer])
        for (const route of routes) {
          const response = await request(
            route.path,
            route.method,
            route.method === 'GET' ? undefined : { role: 'ADMIN' },
          );
          assert.equal(response.status, 403, `${route.method} ${route.path}`);
          assert.equal(response.error.code, 'FORBIDDEN');
        }
      console.log(
        `PASS middleware denied ${routes.length} admin route/method pairs for both guests and customers.`,
      );
    },
  );
  await test(
    'admin pagination, validated settings persistence and conflicting edits',
    { timeout: 180000 },
    async () => {
      const admin = client();
      await admin('/auth/csrf');
      assert.equal((await admin('/auth/demo', 'POST')).status, 200);
      const first = await admin('/admin/products?limit=5&page=1'),
        second = await admin('/admin/products?limit=5&page=2');
      assert.equal(first.data.length, 5);
      assert.equal(second.data.length, 5);
      assert.equal(first.meta.total, second.meta.total);
      assert.ok(first.meta.pages >= 4);
      assert.equal(new Set([...first.data, ...second.data].map((x) => x.id)).size, 10);
      const search = await admin('/admin/products?limit=1&q=Linne');
      assert.equal(search.meta.total, 1);
      assert.equal(search.data[0].slug, 'linne-table-lamp');
      for (const path of [
        'orders',
        'categories',
        'inventory',
        'returns',
        'reviews',
        'coupons',
        'content',
        'audit',
        'notifications',
        'media',
      ]) {
        const page = await admin(`/admin/${path}?limit=1&page=1`);
        assert.equal(page.status, 200, path);
        assert.ok(page.data.length <= 1, path);
        assert.equal(page.meta.page, 1, path);
        assert.ok(typeof page.meta.total === 'number', path);
      }
      const original = (await admin('/admin/config')).data.config;
      assert.equal(
        (
          await admin('/admin/config', 'PUT', {
            expectedRevision: original.revision,
            profile: { ...original, mode: 'production' },
          })
        ).status,
        422,
      );
      assert.equal(
        (
          await admin('/admin/config', 'PUT', {
            expectedRevision: original.revision,
            profile: { ...original, unexpected: 'secret' },
          })
        ).status,
        422,
      );
      const updated = structuredClone(original);
      updated.brand.tagline = 'Persistent settings acceptance';
      const saved = await admin('/admin/config', 'PUT', {
        expectedRevision: original.revision,
        profile: updated,
      });
      assert.equal(saved.status, 200);
      assert.notEqual(saved.data.revision, original.revision);
      assert.equal((await admin('/config')).data.brand.tagline, updated.brand.tagline);
      assert.equal(
        (
          await admin('/admin/config', 'PUT', {
            expectedRevision: original.revision,
            profile: original,
          })
        ).status,
        409,
      );
      applyStoreConfig(original);
      await refreshStoreSettings(true);
      assert.equal((await admin('/config')).data.brand.tagline, updated.brand.tagline);
      assert.equal(
        (await prisma.storeSettings.findUniqueOrThrow({ where: { id: original.storeId } }))
          .revision,
        saved.data.revision,
      );
      assert.equal(
        (
          await admin('/admin/config', 'PUT', {
            expectedRevision: saved.data.revision,
            profile: original,
          })
        ).status,
        200,
      );
      console.log(
        'PASS validated settings survived runtime reload; invalid/security edits rejected; stale edits returned 409.',
      );
    },
  );
} finally {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await prisma.$disconnect();
}
