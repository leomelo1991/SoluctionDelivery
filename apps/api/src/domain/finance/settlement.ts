import type { ContractTerms } from './contracts.js';
import { durationMinutes } from './contracts.js';
/** Política de simulação v1: disponibilidade proporcional à presença, arredondada para baixo.
 * O centavo residual não é cobrado; fixo/garantia é proporcional por entregador e turno. */
export function availabilityCharge(terms: ContractTerms, attendedMinutes: number) {
  const planned = terms.templates.reduce((sum, t) => sum + durationMinutes(t) * t.courierCount, 0);
  if (!Number.isSafeInteger(attendedMinutes) || attendedMinutes < 0 || attendedMinutes > planned)
    throw new Error('Presença incompatível com a capacidade contratada.');
  return {
    plannedMinutes: planned,
    attendedMinutes,
    availability: planned
      ? (BigInt(terms.weeklyAvailabilityCents) * BigInt(attendedMinutes)) / BigInt(planned)
      : 0n,
    platform: BigInt(terms.platformFeeCents),
  };
}
export function shiftEarning(
  terms: ContractTerms,
  attendedMinutes: number,
  shiftMinutes: number,
  deliveries: number,
) {
  if (
    !Number.isSafeInteger(deliveries) ||
    deliveries < 0 ||
    !Number.isSafeInteger(attendedMinutes) ||
    attendedMinutes < 0 ||
    attendedMinutes > shiftMinutes ||
    shiftMinutes <= 0
  )
    throw new Error('Apuração de turno inválida.');
  const fixed = (BigInt(terms.courierFixedCents) * BigInt(attendedMinutes)) / BigInt(shiftMinutes);
  const variable = BigInt(terms.courierDeliveryCents) * BigInt(deliveries);
  const total =
    terms.payModel === 'fixed'
      ? fixed
      : terms.payModel === 'fixed_plus_delivery'
        ? fixed + variable
        : terms.payModel === 'guarantee'
          ? fixed > variable
            ? fixed
            : variable
          : variable;
  return {
    fixed,
    variable,
    supplement: terms.payModel === 'guarantee' && fixed > variable ? fixed - variable : 0n,
    total,
  };
}
