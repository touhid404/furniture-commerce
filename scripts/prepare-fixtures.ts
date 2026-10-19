import { hash } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';
import { prisma } from '../backend/src/db/client.js';
import { assertFixtureEnvironment } from '../tests/fixtures/environment.js';
assertFixtureEnvironment();
try {
  await prisma.user.upsert({
    where: { email: 'demo@elnavo.example' },
    create: {
      email: 'demo@elnavo.example',
      name: 'Demo Admin',
      passwordHash: await hash(randomBytes(32).toString('hex')),
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
    },
    update: {},
  });
  console.log('PASS isolated acceptance admin prepared. Production unchanged.');
} finally {
  await prisma.$disconnect();
}
