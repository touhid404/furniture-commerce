import test from 'node:test';
import assert from 'node:assert/strict';
import { startKeepalive } from '../backend/src/services/keepalive.js';

test('optional keepalive checks the public health URL every 14 minutes and stops cleanly', async () => {
  const original = {
    enabled: process.env.KEEPALIVE_ENABLED,
    url: process.env.PUBLIC_APP_URL,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    fetch: globalThis.fetch,
  };
  let tick: (() => void) | undefined;
  let interval: number | undefined;
  let unrefCalled = false;
  let cleared = false;
  let requestedUrl = '';
  const timer = { unref: () => (unrefCalled = true) };
  try {
    process.env.KEEPALIVE_ENABLED = 'true';
    process.env.PUBLIC_APP_URL = 'https://store.example/shop';
    globalThis.setInterval = ((callback: () => void, ms: number) => {
      tick = callback;
      interval = ms;
      return timer;
    }) as unknown as typeof setInterval;
    globalThis.clearInterval = ((value: unknown) => {
      cleared = value === timer;
    }) as typeof clearInterval;
    globalThis.fetch = (async (url: string | URL | Request) => {
      requestedUrl = String(url);
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    const stop = startKeepalive();
    assert.equal(interval, 14 * 60 * 1000);
    assert.equal(unrefCalled, true);
    assert.equal(requestedUrl, '');
    tick?.();
    await Promise.resolve();
    assert.equal(requestedUrl, 'https://store.example/api/v1/health/live');
    stop();
    assert.equal(cleared, true);
  } finally {
    globalThis.setInterval = original.setInterval;
    globalThis.clearInterval = original.clearInterval;
    globalThis.fetch = original.fetch;
    if (original.enabled === undefined) delete process.env.KEEPALIVE_ENABLED;
    else process.env.KEEPALIVE_ENABLED = original.enabled;
    if (original.url === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = original.url;
  }
});
