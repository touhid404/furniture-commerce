import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import '../env.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is missing. Finish Neon sign-in and run npx neon@latest deploy.');
const parsed = new URL(connectionString);
if (!['postgres:', 'postgresql:'].includes(parsed.protocol))
  throw new Error('DATABASE_URL must be a PostgreSQL URL');
// Make certificate verification explicit instead of relying on pg's evolving require alias.
if (parsed.hostname.endsWith('.neon.tech')) parsed.searchParams.set('sslmode', 'verify-full');

export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: parsed.toString(),
    max: 5,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 10_000,
    statement_timeout: 8_000,
  }),
});

export async function checkDatabase() {
  const started = performance.now();
  const rows = await prisma.$queryRaw<
    Array<{ ok: number; serverTime: Date }>
  >`SELECT 1::int AS ok, CURRENT_TIMESTAMP AS "serverTime"`;
  if (rows[0]?.ok !== 1) throw new Error('Unexpected database probe result');
  return {
    status: 'connected' as const,
    checkedAt: rows[0].serverTime.toISOString(),
    latencyMs: Math.round(performance.now() - started),
  };
}
