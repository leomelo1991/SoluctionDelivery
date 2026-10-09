export type Role = 'admin' | 'establishment' | 'courier';
export type Stage = 'waiting' | 'assigned' | 'accepted' | 'arrived' | 'collected' | 'delivered';
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string;
  establishmentId: string | null;
  courierId: string | null;
  mustChangePassword: boolean;
  csrfToken: string;
  tenantName: string;
  active?: boolean;
}
export interface Address {
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  complement?: string;
}
export interface DeliveryEvent {
  id: string;
  previousStatus: Stage | null;
  newStatus: Stage;
  origin: Role;
  reason?: string;
  createdAt: string;
}
export interface Delivery {
  id: string;
  code: number;
  status: Stage;
  version: number;
  recipientName: string;
  recipientPhone: string;
  pickupAddress: Address;
  destinationAddress: Address;
  notes: string;
  pickupReady: boolean;
  manualDistanceM: number | null;
  distanceSource: string | null;
  feeCents: number;
  courierPayoutCents: number;
  createdAt: string;
  updatedAt: string;
  establishment: { id: string; name: string };
  courier?: { id: string; name: string; phone?: string };
  events?: DeliveryEvent[];
  pricingSnapshot?: Record<string, unknown>;
}
export interface Offer {
  id: string;
  code: number;
  status: Stage;
  version: number;
  courierPayoutCents: number;
  pickupAddress: Address;
  pickupReady: boolean;
  manualDistanceM: number | null;
  distanceSource: string | null;
  destinationRegion: { city: string; district: string };
  establishment: { name: string };
}
export interface Establishment {
  id: string;
  name: string;
  responsible: string;
  phone: string;
  email: string;
  city: string;
  address: Address;
  acquisitionChannel: string;
  lifecycleStatus: string;
  operationOpen: boolean;
  notes?: CRMNote[];
}
export interface CRMNote {
  id: string;
  text: string;
  authorName: string;
  createdAt: string;
}
export interface Courier {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  approvalStatus: string;
  availabilityStatus: string;
  deliveries?: Pick<Delivery, 'id' | 'code' | 'status' | 'courierPayoutCents' | 'createdAt'>[];
}
export interface Formula {
  baseCents: number;
  includedMeters: number;
  perKmCents: number;
  minimumCents: number;
}
export interface Region {
  id: string;
  name: string;
  city: string;
  coverage: string;
  feeCents: number;
  payoutCents: number;
  active: boolean;
  version: number;
}
export interface Surcharge {
  id: string;
  name: string;
  reason: string;
  feeFixedCents: number;
  feePercentBps: number;
  payoutFixedCents: number;
  payoutPercentBps: number;
  startsAt: string;
  endsAt?: string;
  active: boolean;
  version: number;
}
export interface Pricing {
  formula: { fee: Formula; payout: Formula; version: number } | null;
  regions: Region[];
  surcharges: Surcharge[];
  routing: { primary: string; fallback: boolean };
}
export interface Quote {
  id: string;
  expiresAt: string;
  feeCents: number;
  payoutCents: number;
  distanceM: number | null;
  durationSeconds: number | null;
  provider: string | null;
  snapshot: {
    method: string;
    baseFeeCents: number;
    basePayoutCents: number;
    surcharges: Surcharge[];
  };
}
export interface Dashboard {
  period: { from: string; to: string };
  active: number;
  delivered: number;
  completedFreightCents?: number;
  expectedPayoutCents?: number;
  activeFreightCents: number;
  stages: { status: Stage; count: number }[];
  establishments: { status: string; count: number }[];
  couriers: { approval: string; availability: string; count: number }[];
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export const stageLabels: Record<Stage, string> = {
  waiting: 'Aguardando entregador',
  assigned: 'Aguardando aceite',
  accepted: 'Entrega aceita',
  arrived: 'Na coleta',
  collected: 'Em rota',
  delivered: 'Entregue',
};
export const labels: Record<string, string> = {
  lead: 'Prospect',
  onboarding: 'Implantação',
  active: 'Parceiro ativo',
  paused: 'Pausado',
  pending: 'Aguardando aprovação',
  approved: 'Aprovado',
  offline: 'Indisponível',
  available: 'Disponível',
  busy: 'Em entrega',
  admin: 'Administrador',
  establishment: 'Estabelecimento',
  courier: 'Entregador',
  motorcycle: 'Moto',
  bicycle: 'Bicicleta',
  car: 'Carro',
};
export const money = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
export const formatAddress = (a: Address) =>
  `${a.street}, ${a.number}${a.complement ? ' · ' + a.complement : ''} · ${a.district} · ${a.city}/${a.state}`;
export const mapsLink = (a: Address) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(a))}`;

export type { paths, components, operations } from './api.generated';

export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

export interface MobileSession {
  accessToken: string;
  expiresAt: string;
  user: User;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
}
export interface NavigationRoute {
  deliveryId: string;
  version: number;
  leg: 'pickup' | 'dropoff';
  provider: 'google' | 'openrouteservice';
  coordinates: Coordinate[];
  distanceM: number;
  durationSeconds: number;
}
export function navigationLeg(status: Stage): 'pickup' | 'dropoff' | null {
  if (status === 'accepted' || status === 'arrived') return 'pickup';
  return status === 'collected' ? 'dropoff' : null;
}

export type {
  CommercialTemplate,
  CommercialTerms,
  CommercialBudget,
  CommercialVersion,
  CommercialContract,
  CommercialAllocation,
  CommercialShift,
} from './commercial';

export type { MapPoint, OperationsMapPin, OperationsMapSnapshot } from './operations-map';
export * from './position-publisher';
export { financeMoney, payoutLabels } from './finance';
export type {
  FinanceStatus,
  FinanceWalletView,
  FinancePage,
  FinanceStatementItem,
  FinanceReservationView,
  FinanceTopupView,
  FinanceSettlementView,
  FinanceEarningView,
  FinanceTreasuryView,
} from './finance';
