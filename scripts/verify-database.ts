import assert from 'node:assert/strict';
import { prisma, checkDatabase } from '../backend/src/db/client.js';

try {
  const probe = await checkDatabase();
  assert.equal(probe.status, 'connected');
  console.log('PASS Prisma -> Neon pooled PostgreSQL SELECT 1');
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const rows = await tx.$queryRaw<Array<{ doubled: number }>>`SELECT 21::int * 2 AS doubled`;
    return rows[0].doubled;
  });
  assert.equal(result, 42);
  console.log('PASS Prisma read-only transaction result = 42');
  const tables = await prisma.$queryRaw<
    Array<{ count: bigint }>
  >`SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
  console.log(
    `INFO public application tables found: ${tables[0].count.toString()}; no schema changes performed`,
  );
} catch {
  console.error(
    'FAIL database verification; inspect the local Neon environment and connection permissions (credentials omitted)',
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
