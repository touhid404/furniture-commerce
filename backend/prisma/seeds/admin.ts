import { hash } from '@node-rs/argon2';
import { z } from 'zod';
import { prisma } from '../../src/db/client.js';

export async function seedAdmin() {
  const email = z.email().parse(process.env.ADMIN_EMAIL).toLowerCase();
  const password = z.string().min(10).max(128).parse(process.env.ADMIN_PASSWORD);
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== 'ADMIN')
      throw new Error('ADMIN_EMAIL belongs to a customer; refusing to grant admin access.');
    return 'unchanged';
  }
  await prisma.user.create({
    data: {
      email,
      username,
      name: process.env.ADMIN_NAME ?? 'Store admin',
      passwordHash: await hash(password),
      role: 'ADMIN',
      requiresPasswordChange: false,
      emailVerifiedAt: new Date(),
    },
  });
  return 'created';
}
