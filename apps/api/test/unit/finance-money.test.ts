import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cents, financeWeek } from '../../src/domain/finance/money.js';
test('finance uses bounded integer strings, not floats or exponent notation', () => {
  assert.equal(cents('999999999999'), 999999999999n);
  assert.equal(cents('0', true), 0n);
  for (const value of ['0', '-1', '1.2', '1e3', '01', '1000000000000', 'NaN', 'Infinity'])
    assert.throws(() => cents(value));
});
test('financial week has an exclusive next Monday boundary in Sao Paulo', () => {
  const range = financeWeek('2030-01-07');
  assert.equal(range.start.toISOString(), '2030-01-07T03:00:00.000Z');
  assert.equal(range.end.toISOString(), '2030-01-14T03:00:00.000Z');
  for (const value of ['2030-01-08', '2030-02-30', '2010-01-04', '2030-01-07T00:00:00Z'])
    assert.throws(() => financeWeek(value));
});
