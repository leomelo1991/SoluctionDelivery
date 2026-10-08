import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availabilityCharge, shiftEarning } from '../../src/domain/finance/settlement.js';
import type { ContractTerms } from '../../src/domain/finance/contracts.js';
const terms: ContractTerms = {
  timezone: 'America/Sao_Paulo',
  coverage: 'Franca',
  servicePolicy: 'Proporcional',
  weeklyAvailabilityCents: 80000,
  platformFeeCents: 0,
  deliveryFeeCents: 200,
  payModel: 'guarantee',
  courierFixedCents: 10000,
  courierDeliveryCents: 1000,
  templates: [
    { weekday: 1, startMinute: 600, endMinute: 700, courierCount: 2, expectedDeliveries: 10 },
  ],
};
test('availability: full service keeps minimum at zero volume; absent service prorates exactly 800/720/80', () => {
  assert.equal(availabilityCharge(terms, 200).availability, 80000n);
  assert.equal(availabilityCharge(terms, 180).availability, 72000n);
  assert.equal(availabilityCharge(terms, 0).availability, 0n);
  assert.throws(() => availabilityCharge(terms, 201));
});
test('fixed, inclusive fixed, variable and guarantee never double count remuneration', () => {
  assert.equal(shiftEarning({ ...terms, payModel: 'fixed' }, 100, 100, 20).total, 10000n);
  assert.equal(
    shiftEarning({ ...terms, payModel: 'fixed_plus_delivery' }, 100, 100, 20).total,
    30000n,
  );
  assert.equal(shiftEarning({ ...terms, payModel: 'per_delivery' }, 100, 100, 20).total, 20000n);
  assert.equal(shiftEarning(terms, 100, 100, 3).total, 10000n);
  assert.equal(shiftEarning(terms, 100, 100, 3).supplement, 7000n);
  assert.equal(shiftEarning(terms, 100, 100, 20).total, 20000n);
  assert.equal(shiftEarning(terms, 50, 100, 3).total, 5000n);
});
test('cent residual remains with merchant; zero presence cannot earn fixed guarantee', () => {
  assert.equal(availabilityCharge({ ...terms, weeklyAvailabilityCents: 1 }, 100).availability, 0n);
  assert.equal(shiftEarning(terms, 0, 100, 0).total, 0n);
  assert.throws(() => shiftEarning(terms, 101, 100, 0));
});
