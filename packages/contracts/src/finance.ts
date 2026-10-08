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
