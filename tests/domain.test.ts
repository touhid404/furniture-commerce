import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTotals,
  csvCell,
  ownsCart,
  retryableTransaction,
} from '../backend/src/services/calculations.js';
test('discounts and exclusive tax use exact integer amounts', () => {
  assert.deepEqual(calculateTotals(19999n, 10, 500n, 750, false), {
    subtotalMinor: 19999n,
    discountMinor: 1999n,
    shippingMinor: 500n,
    taxMinor: 1350n,
    totalMinor: 19850n,
  });
});
test('included tax is disclosed without adding it twice', () => {
  const t = calculateTotals(12000n, 0, 0n, 2000, true);
  assert.equal(t.taxMinor, 2000n);
  assert.equal(t.totalMinor, 12000n);
});
test('CSV formula prefixes are escaped', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
});

test('guest checkout rejects another guest cart even when both users are null', () => {
  assert.equal(
    ownsCart({ userId: null, sessionId: 'owner' }, { userId: null, id: 'attacker' }),
    false,
  );
  assert.equal(ownsCart({ userId: null, sessionId: 'owner' }, { userId: null, id: 'owner' }), true);
});
test('signed-in checkout is scoped to the account that owns the cart', () => {
  assert.equal(
    ownsCart({ userId: 'customer', sessionId: null }, { userId: 'other', id: 'session' }),
    false,
  );
  assert.equal(
    ownsCart({ userId: 'customer', sessionId: null }, { userId: 'customer', id: 'new-session' }),
    true,
  );
});

test('raw PostgreSQL serialization and deadlock errors are retried with ORM conflicts', () => {
  assert.equal(retryableTransaction({ code: 'P2010', meta: { code: '40001' } }), true);
  assert.equal(retryableTransaction({ code: 'P2010', meta: { code: '40P01' } }), true);
  assert.equal(retryableTransaction({ code: 'P2010', meta: { code: '23514' } }), false);
});
test('taxable shipping follows the configured tax rule', () => {
  assert.equal(calculateTotals(10000n, 0, 500n, 1000, false, true).taxMinor, 1050n);
});

test('Prisma driver adapter exposes PostgreSQL conflicts inside its nested cause', () => {
  assert.equal(
    retryableTransaction({
      code: 'P2010',
      meta: { driverAdapterError: { cause: { originalCode: '40001', kind: 'postgres' } } },
    }),
    true,
  );
});
