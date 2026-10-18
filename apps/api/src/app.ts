import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { publicStoreConfig } from './config.js';
import { checkDatabase } from './db/client.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use((req, res, next) => {
  res.locals.requestId = randomUUID();
  res.setHeader('X-Request-Id', res.locals.requestId);
  next();
});
app.get('/api/v1/config', (_req, res) => res.json({ data: publicStoreConfig() }));
app.get('/api/v1/health/live', (_req, res) => res.json({ data: { status: 'ok' } }));
app.get('/api/v1/health/ready', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try { res.json({ data: { status: 'ready', database: await checkDatabase() } }); }
  catch { res.status(503).json({ error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Database readiness check failed' }, requestId: res.locals.requestId }); }
});
app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not implemented' }, requestId: res.locals.requestId }));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(resolve('dist/storefront')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/storefront/index.html')));
}

const handleError: ErrorRequestHandler = (_error, _req, res, _next) => {
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Request could not be completed' }, requestId: res.locals.requestId });
};
app.use(handleError);
