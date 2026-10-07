import { Decimal } from 'decimal.js';
export interface Formula {
  baseCents: number;
  includedMeters: number;
  perKmCents: number;
  minimumCents: number;
}
export interface Extra {
  fixedCents: number;
  percentBps: number;
}
export function distancePrice(distanceM: number, formula: Formula): number {
  if (!Number.isInteger(distanceM) || distanceM < 0) throw new Error('INVALID_DISTANCE');
  return Decimal.max(
    formula.minimumCents,
    new Decimal(formula.baseCents).plus(
      new Decimal(Math.max(0, distanceM - formula.includedMeters))
        .div(1000)
        .mul(formula.perKmCents),
    ),
  )
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}
export function withSurcharges(baseCents: number, extras: Extra[]): number {
  const bps = extras.reduce((sum, e) => sum + e.percentBps, 0);
  const fixed = extras.reduce((sum, e) => sum + e.fixedCents, 0);
  const result = new Decimal(baseCents)
    .mul(new Decimal(1).plus(new Decimal(bps).div(10000)))
    .plus(fixed)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
  if (!Number.isSafeInteger(result) || result < 0 || result > 2147483647)
    throw new Error('PRICE_OUT_OF_RANGE');
  return result;
}
