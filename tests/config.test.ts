import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStoreConfig, storeConfig, publicStoreConfig } from '../backend/src/config.js';

test('owner branding and currency can change without editing application code', () => {
  const alternate = structuredClone(storeConfig);
  alternate.brand.name = 'Example furniture';
  alternate.currencies = [{ code: 'GBP', minorUnitDigits: 2 }];
  alternate.markets[0].country = 'GB';
  alternate.markets[0].currency = 'GBP';
  alternate.checkout.cod.maximumByCurrency = { GBP: 100000 };
  alternate.dashboard.dailyGoalByCurrency = { GBP: 200000 };
  alternate.shipping.rates[0].currency = 'GBP';
  assert.equal(validateStoreConfig(alternate).markets[0].currency, 'GBP');
});
test('unknown market currency fails', () => {
  const input = structuredClone(storeConfig);
  input.markets[0].currency = 'EUR';
  assert.throws(() => validateStoreConfig(input), /currency and locales/);
});
test('external navigation URLs fail', () => {
  const input = structuredClone(storeConfig);
  input.navigation[0].href = '//outside.example';
  assert.throws(() => validateStoreConfig(input), /local paths/);
});
test('production cannot enable the demo admin bypass', () => {
  const input = structuredClone(storeConfig);
  input.mode = 'production';
  input.features.demoAdmin = true;
  assert.throws(() => validateStoreConfig(input), /demo features/);
});
test('schema rejects unknown secret-shaped keys', () => {
  assert.throws(
    () => validateStoreConfig({ ...storeConfig, paymentSecret: 'not-a-real-key' }),
    /Invalid store/,
  );
});
test('public profile excludes private payment and tax configuration', () => {
  const data = publicStoreConfig();
  assert.deepEqual(Object.keys(data.checkout).sort(), [
    'codEnabled',
    'guestEnabled',
    'maxQuantityPerSku',
    'onlinePaymentLabel',
  ]);
  assert.equal('tax' in data, false);
  assert.equal('cod' in data.checkout, false);
  assert.equal('card' in data.checkout, false);
  assert.equal(data.capabilities.commerceReady, true);
});
