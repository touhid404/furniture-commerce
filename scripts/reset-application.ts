// Deliberately separate from seed. The owner must name both project and branch.
import { z } from 'zod';
import { hash } from '@node-rs/argon2';
import { prisma } from '../backend/src/db/client.js';
import { storeConfig } from '../backend/src/config.js';
import { assertResetAllowed } from './reset-guard.js';

const tables = [
  'User',
  'Session',
  'AuthToken',
  'Address',
  'Category',
  'MediaAsset',
  'Product',
  'ProductVariant',
  'Price',
  'Inventory',
  'InventoryMovement',
  'Cart',
  'CartItem',
  'Coupon',
  'CheckoutQuote',
  'Order',
  'OrderItem',
  'OrderEvent',
  'Shipment',
  'ReturnRequest',
  'Refund',
  'Review',
  'ContentRevision',
  'AuditLog',
  'OutboxJob',
];
try {
  assertResetAllowed(process.argv.slice(2), process.env, storeConfig.mode);
  const passwordHash = await hash('1234');
  await prisma.$queryRaw`SELECT 1::int`;
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(147296, 1)`;
      // Fixed identifiers only; preserves schema, migration history and required StoreSettings JSON.
      await tx.$executeRawUnsafe('TRUNCATE TABLE ' + tables.map((t) => `"${t}"`).join(', '));
      await tx.user.create({
        data: {
          email: z.email().parse(process.env.ADMIN_EMAIL ?? 'admin@ex.com'),
          username: 'admin',
          name: 'Store admin',
          passwordHash,
          role: 'ADMIN',
          requiresPasswordChange: true,
          emailVerifiedAt: new Date(),
        },
      });
    },
    { maxWait: 30_000, timeout: 60_000 },
  );
  console.log(
    `PASS reset ${process.env.NEON_BRANCH}: 25 application tables cleared; schema and migrations preserved. Local testing admin created; replace its password before production runtime.`,
  );
} finally {
  await prisma.$disconnect();
}
