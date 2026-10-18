import test from 'node:test';import assert from 'node:assert/strict';
import { calculateTotals, csvCell, ownsCart } from '../backend/src/services/calculations.js';
test('discounts and exclusive tax use exact integer amounts',()=>{assert.deepEqual(calculateTotals(19999n,10,500n,750,false),{subtotalMinor:19999n,discountMinor:1999n,shippingMinor:500n,taxMinor:1350n,totalMinor:19850n});});
test('included tax is disclosed without adding it twice',()=>{const t=calculateTotals(12000n,0,0n,2000,true);assert.equal(t.taxMinor,2000n);assert.equal(t.totalMinor,12000n);});
test('CSV formula prefixes are escaped',()=>{assert.equal(csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');});

test('guest checkout rejects another guest cart even when both users are null', () => {
  assert.equal(ownsCart({ userId: null, sessionId: 'owner' }, { userId: null, id: 'attacker' }), false);
  assert.equal(ownsCart({ userId: null, sessionId: 'owner' }, { userId: null, id: 'owner' }), true);
});
test('signed-in checkout is scoped to the account that owns the cart', () => {
  assert.equal(ownsCart({ userId: 'customer', sessionId: null }, { userId: 'other', id: 'session' }), false);
  assert.equal(ownsCart({ userId: 'customer', sessionId: null }, { userId: 'customer', id: 'new-session' }), true);
});
