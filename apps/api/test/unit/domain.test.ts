import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distancePrice, withSurcharges } from '../../src/domain/pricing.js';
import { canTransition } from '../../src/domain/deliveries.js';
import { inputHash } from '../../src/modules/transactions.js';
const formula = { baseCents: 500, includedMeters: 1000, perKmCents: 200, minimumCents: 700 };
test('distance respects included kilometers, minimum and excess', () => {
  assert.equal(distancePrice(500, formula), 700);
  assert.equal(distancePrice(2000, formula), 700);
  assert.equal(distancePrice(4500, formula), 1200);
});
test('percentages accumulate over base and fixed amounts are added after', () => {
  assert.equal(
    withSurcharges(1000, [
      { fixedCents: 200, percentBps: 1000 },
      { fixedCents: 100, percentBps: 2000 },
    ]),
    1600,
  );
});
test('cent rounding is HALF_UP and fractional kilometer is accounted for', () => {
  assert.equal(withSurcharges(105, [{ fixedCents: 0, percentBps: 1000 }]), 116);
  assert.equal(
    distancePrice(1005, { baseCents: 0, includedMeters: 0, perKmCents: 100, minimumCents: 0 }),
    101,
  );
});
test('invalid and oversized monetary inputs fail', () => {
  assert.throws(() => distancePrice(-1, formula));
  assert.throws(() => withSurcharges(2147483647, [{ fixedCents: 1, percentBps: 0 }]));
});
test('transitions require pickup arrival and collection, never reopen delivered', () => {
  assert.equal(canTransition('accepted', 'arrived'), true);
  assert.equal(canTransition('arrived', 'collected'), true);
  assert.equal(canTransition('collected', 'delivered'), true);
  assert.equal(canTransition('waiting', 'delivered'), false);
  assert.equal(canTransition('accepted', 'collected'), false);
  assert.equal(canTransition('delivered', 'accepted'), false);
});
test('idempotency hashes are independent of object key order', () => {
  assert.equal(inputHash({ b: 2, a: { y: 2, x: 1 } }), inputHash({ a: { x: 1, y: 2 }, b: 2 }));
  assert.notEqual(inputHash({ a: 1 }), inputHash({ a: 2 }));
});
