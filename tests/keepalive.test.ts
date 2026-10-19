import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import cron from 'node-cron';
import { config } from '../backend/src/config/config.js';
import { startKeepalive } from '../backend/src/services/keepalive.js';

test('production cron calls the public health endpoint and stops cleanly', async () => {
  const original = {
    env: process.env.NODE_ENV,
    url: process.env.PUBLIC_APP_URL,
    renderUrl: process.env.RENDER_EXTERNAL_URL,
    get: axios.get,
    log: console.log,
  };
  let requestedUrl = '';
  try {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_APP_URL = 'https://store.example';
    delete process.env.RENDER_EXTERNAL_URL;
    axios.get = (async (url: string) => {
      requestedUrl = url;
      return { status: 200 };
    }) as typeof axios.get;
    console.log = () => undefined;

    const before = new Set(cron.getTasks().keys());
    const stop = startKeepalive();
    const task = [...cron.getTasks()].find(([id]) => !before.has(id))?.[1];
    assert.ok(task);
    await task.execute();
    assert.equal(requestedUrl, 'https://store.example/api/v1/health/live');
    stop();
    assert.equal(task.getStatus(), 'destroyed');
  } finally {
    axios.get = original.get;
    console.log = original.log;
    if (original.env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original.env;
    if (original.url === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = original.url;
    if (original.renderUrl === undefined) delete process.env.RENDER_EXTERNAL_URL;
    else process.env.RENDER_EXTERNAL_URL = original.renderUrl;
  }
});

test('Render URL fallback works and missing URL leaves the app running', () => {
  const original = {
    env: process.env.NODE_ENV,
    url: process.env.PUBLIC_APP_URL,
    renderUrl: process.env.RENDER_EXTERNAL_URL,
    error: console.error,
  };
  try {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_APP_URL = '';
    process.env.RENDER_EXTERNAL_URL = 'https://elnavo.onrender.com';
    assert.equal(config.pingUrl, 'https://elnavo.onrender.com/api/v1/health/live');
    delete process.env.RENDER_EXTERNAL_URL;
    console.error = () => undefined;
    assert.equal(config.pingUrl, '');
    startKeepalive()();
    process.env.PUBLIC_APP_URL = 'http://127.0.0.1:3001';
    assert.equal(config.pingUrl, '');
    startKeepalive()();
  } finally {
    console.error = original.error;
    if (original.env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original.env;
    if (original.url === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = original.url;
    if (original.renderUrl === undefined) delete process.env.RENDER_EXTERNAL_URL;
    else process.env.RENDER_EXTERNAL_URL = original.renderUrl;
  }
});

test('cron does not run in development', () => {
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'development';
    const before = cron.getTasks().size;
    startKeepalive()();
    assert.equal(cron.getTasks().size, before);
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
});
