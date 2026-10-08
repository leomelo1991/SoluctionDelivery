export interface FinanceStatus {
  enabled: boolean;
  mode: 'sandbox';
  canManage: boolean;
}
export interface FinanceWalletView {
  mode: 'sandbox';
  establishment: { id: string; name: string };
  configured: boolean;
  enabled: boolean;
  availableCents: string;
  reservedCents: string;
}
export interface FinancePage<T> {
  items: T[];
  nextCursor: string | null;
}
export interface FinanceStatementItem {
  id: string;
  createdAt: string;
  description: string;
  source: string;
  availableDeltaCents: string;
  reservedDeltaCents: string;
}
export interface FinanceReservationView {
  id: string;
  kind: 'week' | 'delivery';
  source: string;
  amountCents: string;
  consumedCents: string;
  status: 'reserved' | 'closed';
  createdAt: string;
  closedAt: string | null;
}
export interface FinanceTopupView {
  id: string;
  reference: string;
  amountCents: string;
  status: 'pending' | 'unknown' | 'confirmed' | 'rejected';
  createdAt: string;
}
/** Formata BigInt sem perda de centavos em saldos agregados. */
export function financeMoney(value: string) {
  const n = BigInt(value),
    abs = n < 0n ? -n : n;
  return `${n < 0n ? '-' : ''}R$ ${(abs / 100n).toLocaleString('pt-BR')},${(abs % 100n).toString().padStart(2, '0')}`;
}
export interface FinanceSettlementView {
  id: string;
  versionId: string;
  weekStart: string;
  createdAt: string;
  totalCents: string;
  availabilityCents: string;
  platformCents: string;
  variableCents: string;
  releasedCents: string;
  plannedMinutes: number;
  attendedMinutes: number;
}
export interface FinanceEarningView {
  id: string;
  courierId: string;
  courierName: string;
  amountCents: string;
  createdAt: string;
  snapshot: {
    attendedMinutes: number;
    deliveries: number;
    fixed: string;
    variable: string;
    supplement: string;
    total: string;
  };
  payouts: {
    id: string;
    amountCents: string;
    status: 'pending' | 'unknown' | 'paid' | 'rejected' | 'returned';
    createdAt: string;
  }[];
}
export const payoutLabels = {
  pending: 'Repasse simulado pendente',
  unknown: 'Confirmação simulada pendente',
  paid: 'Pago no simulador',
  rejected: 'Recusado no simulador',
  returned: 'Devolvido no simulador',
};
export interface FinanceTreasuryView {
  mode: 'sandbox';
  cashCents: string;
  merchantCreditCents: string;
  pendingPayoutCents: string;
  freeCashCents: string;
  dueCents: string;
  revenueCents: string;
  costCents: string;
  accountingConsistent: boolean;
}
