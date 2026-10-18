import { defineConfig } from 'prisma/config';
import { loadEnvironment } from './backend/src/env.js';

loadEnvironment();

export default defineConfig({
  schema: 'backend/prisma/schema',
  migrations: { path: 'backend/prisma/migrations' },
  // Undefined is allowed for client generation in CI. Migration commands require this URL.
  datasource: { url: process.env.DATABASE_URL_UNPOOLED },
});
