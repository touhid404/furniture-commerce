// Operator-only publishing of a reviewed bootstrap JSON. Defaults to a read-only dry run.
import { prisma } from '../backend/src/db/client.js';
import { storeConfig } from '../backend/src/config.js';
import { saveStoreSettings } from '../backend/src/services/store-settings.js';
try {
  const args = process.argv.slice(2),
    apply = args.includes('--apply'),
    index = args.indexOf('--expected-revision');
  const stored = await prisma.storeSettings.findUnique({ where: { id: storeConfig.storeId } }),
    revision = stored?.revision ?? storeConfig.revision;
  console.log(
    `PASS validated JSON for ${storeConfig.storeId}; ${storeConfig.markets.filter((m) => m.enabled).length} enabled markets. Current saved revision: ${revision}`,
  );
  if (!apply)
    console.log(
      'Dry run only. Review the JSON, then use --apply --expected-revision <current revision> to publish it.',
    );
  else {
    if (index < 0 || !args[index + 1])
      throw Error('Publishing requires --expected-revision from a fresh dry run.');
    const admin = await prisma.user.findUnique({ where: { email: process.env.ADMIN_EMAIL ?? '' } });
    if (!admin || admin.role !== 'ADMIN' || admin.disabled)
      throw Error('ADMIN_EMAIL must identify an active administrator.');
    if (
      admin.requiresPasswordChange &&
      (storeConfig.mode === 'production' || process.env.NODE_ENV === 'production')
    )
      throw Error('Replace the development admin password before production operations.');
    const saved = await saveStoreSettings(storeConfig, args[index + 1], admin.id);
    console.log(
      `PASS published validated store JSON revision ${saved.revision}; security and deployment flags remain server controlled.`,
    );
  }
} finally {
  await prisma.$disconnect();
}
