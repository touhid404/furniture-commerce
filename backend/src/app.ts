import { refreshStoreSettings } from './services/store-settings.js';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { ZodError } from 'zod';
import { publicStoreConfig } from './config.js';
import { checkDatabase } from './db/client.js';
import { account, auth, csrf, sessionMiddleware } from './modules/auth.js';
import { catalog } from './modules/catalog.js';
import { commerce } from './modules/commerce.js';
import { admin } from './modules/admin.js';
import { publicMedia } from './modules/media.js';
import { ApiError } from './services/core.js';
import { robots, sitemap, storefrontDocument } from './services/seo.js';
export const app = express();
app.disable('x-powered-by');
app.set('json replacer', (_key: string, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));
app.use(
  helmet({ contentSecurityPolicy: { directives: { 'img-src': ["'self'", 'data:', 'https:'] } } }),
);
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.locals.requestId = randomUUID();
  res.set('X-Request-Id', res.locals.requestId);
  const start = performance.now();
  res.on('finish', () => {
    if (process.env.REQUEST_LOGS === 'true')
      console.log(
        JSON.stringify({
          requestId: res.locals.requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Math.round(performance.now() - start),
        }),
      );
  });
  next();
});
app.get('/api/v1/health/live', (_req, res) => res.json({ data: { status: 'ok' } }));
app.get('/api/v1/health/ready', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    res.json({ data: { status: 'ready', database: await checkDatabase() } });
  } catch {
    res.status(503).json({
      error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Database readiness check failed' },
      requestId: res.locals.requestId,
    });
  }
});
app.use('/media', publicMedia);
app.use(
  '/api',
  rateLimit({ windowMs: 60000, limit: 240, standardHeaders: true, legacyHeaders: false }),
);
app.use(
  '/api',
  (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  },
  sessionMiddleware,
  csrf,
);
app.use('/api/v1', async (_req, _res, next) => {
  await refreshStoreSettings();
  next();
});
app.get('/api/v1/config', (_req, res) => res.json({ data: publicStoreConfig() }));
app.use('/api/v1/auth', auth);
app.use('/api/v1/account', account);
app.use('/api/v1', catalog, commerce);
app.use('/api/v1/admin', admin);
app.use('/api', (_req, res) =>
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'API endpoint not found' },
    requestId: res.locals.requestId,
  }),
);
if (process.env.NODE_ENV === 'production') {
  app.get('/robots.txt', robots);
  app.get('/sitemap.xml', sitemap);
  app.use(express.static(resolve(process.env.PROJECT_ROOT!, 'backend/public'), { index: false }));
  app.get('/{*path}', storefrontDocument);
}
const errorHandler: ErrorRequestHandler = (e, _req, res, _next) => {
  if (e?.type === 'entity.too.large') {
    res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'The upload exceeds the allowed size.' },
    });
    return;
  }
  if (e instanceof SyntaxError && 'body' in e) {
    res
      .status(400)
      .json({ error: { code: 'INVALID_JSON', message: 'Send a valid JSON request.' } });
    return;
  }
  if (e instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: e.issues[0]?.message ?? 'Check your input',
        fields: e.flatten().fieldErrors,
      },
      requestId: res.locals.requestId,
    });
    return;
  }
  if (e instanceof ApiError) {
    res
      .status(e.status)
      .json({ error: { code: e.code, message: e.message }, requestId: res.locals.requestId });
    return;
  }
  const code = e && typeof e === 'object' && 'code' in e ? e.code : '';
  if (code === 'P2002') {
    res.status(409).json({
      error: { code: 'CONFLICT', message: 'A record with these details already exists.' },
      requestId: res.locals.requestId,
    });
    return;
  }
  if (code === 'P2003') {
    res.status(409).json({
      error: { code: 'IN_USE', message: 'This record is still referenced.' },
      requestId: res.locals.requestId,
    });
    return;
  }
  console.error(
    JSON.stringify({
      requestId: res.locals.requestId,
      error: e instanceof Error ? e.name : 'Unknown',
      code,
    }),
  );
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Request could not be completed' },
    requestId: res.locals.requestId,
  });
};
app.use(errorHandler);
