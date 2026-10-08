import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contractBudget,
  courierPay,
  shiftEnd,
  type ContractTerms,
} from '../../src/domain/finance/contracts.js';
const terms: ContractTerms = {
  timezone: 'America/Sao_Paulo',
  coverage: 'Franca',
  servicePolicy: 'Disponibilidade cumprida',
  weeklyAvailabilityCents: 60000,
  platformFeeCents: 0,
  deliveryFeeCents: 200,
  payModel: 'fixed',
  courierFixedCents: 5000,
  courierDeliveryCents: 0,
  templates: [
    { weekday: 1, startMinute: 1080, endMinute: 1380, courierCount: 2, expectedDeliveries: 100 },
  ],
};
test('weekly minimum, volume and capacity remain independent', () => {
  assert.equal(contractBudget(terms).merchantCents, 80000);
  assert.equal(contractBudget(terms).courierMinutes, 600);
  assert.equal(
    contractBudget({ ...terms, templates: [{ ...terms.templates[0], expectedDeliveries: 60 }] })
      .merchantCents,
    72000,
  );
  assert.equal(
    contractBudget({ ...terms, templates: [{ ...terms.templates[0], expectedDeliveries: 0 }] })
      .merchantCents,
    60000,
  );
  assert.equal(contractBudget(terms).estimatedCourierCents, 10000);
});
test('guarantee complements earnings without double payment', () => {
  assert.equal(courierPay('guarantee', 10000, 7000), 10000);
  assert.equal(courierPay('guarantee', 10000, 12000), 12000);
  assert.equal(courierPay('fixed', 10000, 12000), 10000);
  assert.equal(courierPay('fixed_plus_delivery', 10000, 12000), 22000);
});
test('weekly overlap, overnight and Sao Paulo timezone boundaries', () => {
  const t = {
    weekday: 1,
    startMinute: 1320,
    endMinute: 120,
    courierCount: 1,
    expectedDeliveries: 10,
  };
  assert.equal(
    shiftEnd(new Date('2030-01-08T01:00:00Z'), t, 'America/Sao_Paulo').toISOString(),
    '2030-01-08T05:00:00.000Z',
  );
  assert.throws(
    () =>
      contractBudget({
        ...terms,
        templates: [t, { ...t, weekday: 2, startMinute: 60, endMinute: 180 }],
      }),
    /sobrepor/,
  );
  assert.throws(
    () =>
      contractBudget({
        ...terms,
        templates: [
          { ...t, weekday: 6 },
          { ...t, weekday: 0, startMinute: 60, endMinute: 180 },
        ],
      }),
    /sobrepor/,
  );
  assert.throws(
    () => shiftEnd(new Date('2030-01-08T02:00:00Z'), t, 'America/Sao_Paulo'),
    /horário/,
  );
  assert.throws(() => contractBudget({ ...terms, courierDeliveryCents: 100 }), /parcela/);
});
