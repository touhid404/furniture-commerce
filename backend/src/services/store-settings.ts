import { randomUUID } from 'node:crypto';
import { prisma } from '../db/client.js';
import { applyStoreConfig, storeConfig, validateStoreConfig, type StoreConfig } from '../config.js';
import { atomic, audit, canonical, fail, json } from './core.js';
// Deployment identity, payment scope and authentication switches cannot be changed from the dashboard.
const locked = (value: typeof storeConfig) => ({
  schemaVersion: value.schemaVersion,
  storeId: value.storeId,
  mode: value.mode,
  features: value.features,
  card: value.checkout.card,
  guestEnabled: value.checkout.guestEnabled,
});
let checkedAt = 0;
let pending: Promise<void> | null = null;
export function refreshStoreSettings(force = false): Promise<void> {
  if (!force && Date.now() - checkedAt < 5000) return Promise.resolve();
  if (pending) return pending;
  pending = prisma.storeSettings
    .findUnique({ where: { id: storeConfig.storeId } })
    .then((saved) => {
      if (saved && saved.revision !== storeConfig.revision) {
        const profile = saved.profile as unknown as StoreConfig;
        // Reviewed deployment changes always control security, even when old merchant settings exist.
        const candidate = validateStoreConfig({
          ...profile,
          schemaVersion: storeConfig.schemaVersion,
          storeId: storeConfig.storeId,
          mode: storeConfig.mode,
          features: storeConfig.features,
          checkout: {
            ...profile.checkout,
            card: storeConfig.checkout.card,
            guestEnabled: storeConfig.checkout.guestEnabled,
          },
        });
        applyStoreConfig(candidate);
      }
      checkedAt = Date.now();
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}
export async function saveStoreSettings(
  profile: unknown,
  expectedRevision: string,
  actorId: string,
) {
  let candidate;
  try {
    candidate = validateStoreConfig(profile);
  } catch (error) {
    fail(422, 'CONFIG_INVALID', error instanceof Error ? error.message : 'Invalid store profile.');
  }
  if (canonical(locked(candidate)) !== canonical(locked(storeConfig)))
    fail(
      422,
      'CONFIG_LOCKED',
      'Deployment identity, authentication features and card payment setup are server-controlled.',
    );
  const next = { ...candidate, revision: randomUUID() };
  await atomic(async (tx) => {
    // Serialize both the initial insert and subsequent edits across server instances.
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(987126001)`;
    const current = await tx.storeSettings.findUnique({ where: { id: storeConfig.storeId } });
    if ((current?.revision ?? storeConfig.revision) !== expectedRevision)
      fail(409, 'CONFIG_CHANGED', 'Store settings changed. Reload the page before saving again.');
    await tx.storeSettings.upsert({
      where: { id: storeConfig.storeId },
      create: { id: storeConfig.storeId, revision: next.revision, profile: json(next) },
      update: { revision: next.revision, profile: json(next) },
    });
    await audit(tx, actorId, 'STORE_SETTINGS_UPDATED', storeConfig.storeId, {
      previousRevision: expectedRevision,
      revision: next.revision,
    });
  });
  applyStoreConfig(next);
  checkedAt = Date.now();
  return next;
}
