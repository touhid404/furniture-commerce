import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import cron from 'node-cron';
import {
  createKeepaliveTask,
  keepaliveSchedule,
  startKeepalive,
} from '../backend/src/services/keepalive.js';

test('production cron pings the configured HTTPS health URL every 14 minutes', async () => {
  const original = {
    env: process.env.NODE_ENV,
    url: process.env.PUBLIC_APP_URL,
  };
  let requestedUrl = '';
  let timeout = 0;
  let redirects = -1;
  const info = console.info;
  try {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_APP_URL = 'https://store.example/shop';
    console.info = () => undefined;
    const request = (async (url: string, options: { timeout: number; maxRedirects: number }) => {
      requestedUrl = url;
      timeout = options.timeout;
      redirects = options.maxRedirects;
      return { status: 200 };
    }) as typeof axios.get;

    assert.equal(keepaliveSchedule, '*/14 * * * *');
    assert.equal(cron.validate(keepaliveSchedule), true);
    const task = createKeepaliveTask(request);
    assert.ok(task);
    assert.equal(task.getStatus(), 'stopped');
    await task.execute();
    assert.equal(requestedUrl, 'https://store.example/api/v1/health/live');
    assert.equal(timeout, 10_000);
    assert.equal(redirects, 0);
    task.destroy();
  } finally {
    console.info = info;
    if (original.env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original.env;
    if (original.url === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = original.url;
  }
});

test('cron job only runs in production', () => {
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'development';
    assert.equal(createKeepaliveTask(), undefined);
    startKeepalive()();
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
});
