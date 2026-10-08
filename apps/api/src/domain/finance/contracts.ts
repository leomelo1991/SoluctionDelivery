export type PayModel = 'per_delivery' | 'fixed' | 'fixed_plus_delivery' | 'guarantee';
export interface ShiftTemplate {
  weekday: number;
  startMinute: number;
  endMinute: number;
  courierCount: number;
  expectedDeliveries: number;
}
export interface ContractTerms {
  timezone: 'America/Sao_Paulo';
  coverage: string;
  servicePolicy: string;
  weeklyAvailabilityCents: number;
  platformFeeCents: number;
  deliveryFeeCents: number;
  payModel: PayModel;
  courierFixedCents: number;
  courierDeliveryCents: number;
  templates: ShiftTemplate[];
}
export function durationMinutes(t: ShiftTemplate) {
  return (t.endMinute - t.startMinute + 1440) % 1440 || 1440;
}
export function courierPay(model: PayModel, fixed: number, variable: number) {
  if (model === 'fixed') return fixed;
  if (model === 'fixed_plus_delivery') return fixed + variable;
  if (model === 'guarantee') return Math.max(fixed, variable);
  return variable;
}
export function validateTerms(t: ContractTerms) {
  if (t.payModel === 'per_delivery' && t.courierFixedCents !== 0)
    throw new Error('Remuneração por entrega exige fixo igual a zero.');
  if (t.payModel === 'fixed' && t.courierDeliveryCents !== 0)
    throw new Error('Remuneração fixa exige parcela por entrega igual a zero.');
  const spans = t.templates.flatMap((v) => {
    const start = v.weekday * 1440 + v.startMinute;
    const end = start + durationMinutes(v);
    return end <= 10080
      ? [[start, end]]
      : [
          [start, 10080],
          [0, end - 10080],
        ];
  });
  for (let i = 0; i < spans.length; i++)
    for (let j = i + 1; j < spans.length; j++)
      if (spans[i][0] < spans[j][1] && spans[j][0] < spans[i][1])
        throw new Error(
          'Os turnos do contrato não podem se sobrepor; ajuste a quantidade simultânea.',
        );
}
export function contractBudget(t: ContractTerms) {
  validateTerms(t);
  const deliveries = t.templates.reduce((n, v) => n + v.expectedDeliveries, 0);
  const courierMinutes = t.templates.reduce((n, v) => n + durationMinutes(v) * v.courierCount, 0);
  const estimatedCourierCents = t.templates.reduce((sum, v) => {
    // Simulation distributes forecast deliveries evenly; actual settlement uses each courier's work.
    const each = Math.floor(v.expectedDeliveries / v.courierCount);
    return (
      sum +
      Array.from({ length: v.courierCount }, (_, i) =>
        courierPay(
          t.payModel,
          t.courierFixedCents,
          (each + (i < v.expectedDeliveries % v.courierCount ? 1 : 0)) * t.courierDeliveryCents,
        ),
      ).reduce((a, b) => a + b, 0)
    );
  }, 0);
  const merchantCents =
    t.weeklyAvailabilityCents + t.platformFeeCents + deliveries * t.deliveryFeeCents;
  return {
    deliveries,
    courierMinutes,
    merchantCents,
    estimatedCourierCents,
    grossMarginCents: merchantCents - estimatedCourierCents,
  };
}
export function shiftEnd(start: Date, t: ShiftTemplate, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(start)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  if (
    weekday !== t.weekday ||
    Number(parts.hour) * 60 + Number(parts.minute) !== t.startMinute ||
    Number(parts.second) !== 0 ||
    start.getUTCMilliseconds() !== 0
  )
    throw new Error('A data e o horário precisam corresponder ao turno no fuso de São Paulo.');
  return new Date(start.getTime() + durationMinutes(t) * 60000);
}
