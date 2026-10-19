import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import cron from 'node-cron';
import { loadEnvironment } from '../backend/src/env.js';
import {
  createKeepaliveTask,
  keepaliveSchedule,
  startKeepalive,
} from '../backend/src/services/keepalive.js';

test('production cron pings the configured HTTPS health URL every 14 minutes', async () => {
  const original = {
    env: process.env.NODE_ENV,
    url: process.env.PUBLIC_APP_URL,
    renderUrl: process.env.RENDER_EXTERNAL_URL,
  };
  let requestedUrl = '';
  let timeout = 0;
  let redirects = -1;
  const info = console.info;
  try {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_APP_URL = 'https://store.example/shop';
    delete process.env.RENDER_EXTERNAL_URL;
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
    if (original.renderUrl === undefined) delete process.env.RENDER_EXTERNAL_URL;
    else process.env.RENDER_EXTERNAL_URL = original.renderUrl;
  }
});

test('Render URL fallback works and missing URLs do not crash production', async () => {
  const original = {
    env: process.env.NODE_ENV,
    url: process.env.PUBLIC_APP_URL,
    renderUrl: process.env.RENDER_EXTERNAL_URL,
  };
  const warn = console.warn;
  let requestedUrl = '';
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.PUBLIC_APP_URL;
    process.env.RENDER_EXTERNAL_URL = 'https://elnavo.onrender.com';
    console.warn = () => undefined;
    const request = (async (url: string) => {
      requestedUrl = url;
      return { status: 200 };
    }) as typeof axios.get;
    const task = createKeepaliveTask(request);
    assert.ok(task);
    const info = console.info;
    try {
      console.info = () => undefined;
      await task.execute();
    } finally {
      console.info = info;
      task.destroy();
    }
    assert.equal(requestedUrl, 'https://elnavo.onrender.com/api/v1/health/live');

    delete process.env.RENDER_EXTERNAL_URL;
    assert.equal(createKeepaliveTask(request), undefined);
    process.env.PUBLIC_APP_URL = 'http://127.0.0.1:3001';
    assert.equal(createKeepaliveTask(request), undefined);
  } finally {
    console.warn = warn;
    if (original.env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original.env;
    if (original.url === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = original.url;
    if (original.renderUrl === undefined) delete process.env.RENDER_EXTERNAL_URL;
    else process.env.RENDER_EXTERNAL_URL = original.renderUrl;
  }
});

test('Render public URL becomes the application origin when no override exists', () => {
  const original = {
    url: process.env.PUBLIC_APP_URL,
    renderUrl: process.env.RENDER_EXTERNAL_URL,
  };
  try {
    process.env.PUBLIC_APP_URL = '';
    process.env.RENDER_EXTERNAL_URL = 'https://elnavo.onrender.com';
    loadEnvironment();
    assert.equal(process.env.PUBLIC_APP_URL, 'https://elnavo.onrender.com');
  } finally {
    if (original.url === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = original.url;
    if (original.renderUrl === undefined) delete process.env.RENDER_EXTERNAL_URL;
    else process.env.RENDER_EXTERNAL_URL = original.renderUrl;
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
