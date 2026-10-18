import { defineConfig } from 'prisma/config';
import { loadEnvironment } from './apps/api/src/env.js';

loadEnvironment();

export default defineConfig({
  schema: 'apps/api/prisma/schema.prisma',
  migrations: { path: 'apps/api/prisma/migrations' },
  // Undefined is allowed for client generation in CI. Migration commands require this URL.
  datasource: { url: process.env.DATABASE_URL_UNPOOLED },
});
