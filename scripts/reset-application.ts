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
  const passwordHash = await hash(z.string().min(10).max(128).parse(process.env.ADMIN_PASSWORD));
  await prisma.$queryRaw`SELECT 1::int`;
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(147296, 1)`;
      // Fixed identifiers only; preserves schema, migration history and required StoreSettings JSON.
      await tx.$executeRawUnsafe('TRUNCATE TABLE ' + tables.map((t) => `"${t}"`).join(', '));
      await tx.user.create({
        data: {
          email: z.email().parse(process.env.ADMIN_EMAIL),
          username: process.env.ADMIN_USERNAME ?? 'admin',
          name: process.env.ADMIN_NAME ?? 'Store admin',
          passwordHash,
          role: 'ADMIN',
          requiresPasswordChange: false,
          emailVerifiedAt: new Date(),
        },
      });
    },
    { maxWait: 30_000, timeout: 60_000 },
  );
  console.log(
    `PASS reset ${process.env.NEON_BRANCH}: 25 application tables cleared; schema and migrations preserved. Admin created from environment credentials.`,
  );
} finally {
  await prisma.$disconnect();
}
