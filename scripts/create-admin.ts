import { hash } from '@node-rs/argon2';
import { prisma } from '../backend/src/db/client.js';
import { z } from 'zod';
const address = z.email().parse(process.env.ADMIN_EMAIL).toLowerCase();
const password = z.string().min(12).parse(process.env.ADMIN_PASSWORD);
try {
  await prisma.user.upsert({
    where: { email: address },
    create: {
      email: address,
      name: process.env.ADMIN_NAME ?? 'Store admin',
      passwordHash: await hash(password),
      role: 'ADMIN',
      username: process.env.ADMIN_USERNAME ?? undefined,
      requiresPasswordChange: false,
      emailVerifiedAt: new Date(),
    },
    update: {
      role: 'ADMIN',
      passwordHash: await hash(password),
      requiresPasswordChange: false,
      ...(process.env.ADMIN_USERNAME ? { username: process.env.ADMIN_USERNAME } : {}),
    },
  });
  console.log('Administrator provisioned. Sign in and enroll MFA before production operations.');
} finally {
  await prisma.$disconnect();
}
