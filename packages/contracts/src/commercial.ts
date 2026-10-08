export interface CommercialTemplate {
  weekday: number;
  startMinute: number;
  endMinute: number;
  courierCount: number;
  expectedDeliveries: number;
}
export interface CommercialTerms {
  timezone: 'America/Sao_Paulo';
  coverage: string;
  servicePolicy: string;
  weeklyAvailabilityCents: number;
  platformFeeCents: number;
  deliveryFeeCents: number;
  payModel?: 'per_delivery' | 'fixed' | 'fixed_plus_delivery' | 'guarantee';
  courierFixedCents?: number;
  courierDeliveryCents?: number;
  templates: CommercialTemplate[];
}
export interface CommercialBudget {
  deliveries: number;
  courierMinutes: number;
  merchantCents: number;
  estimatedCourierCents?: number;
  grossMarginCents?: number;
}
export interface CommercialVersion {
  id: string;
  number: number;
  revision: number;
  status: 'draft' | 'proposed' | 'accepted';
  effectiveFrom: string;
  effectiveTo: string;
  terms: CommercialTerms;
  budget: CommercialBudget;
  acceptedAt: string | null;
  acceptanceEvidence: string | null;
}
export interface CommercialContract {
  id: string;
  title: string;
  establishmentId: string;
  establishment: { id: string; name: string };
  versions: CommercialVersion[];
}
export interface CommercialAllocation {
  id: string;
  position: number;
  startsAt: string;
  endsAt: string;
  cancelledAt: string | null;
  courier: { id: string; name: string };
  attendance: { id: string; attendedMinutes: number; reason: string; createdAt: string }[];
}
export interface CommercialShift {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  version: CommercialVersion & { contract: CommercialContract };
  allocations: CommercialAllocation[];
}
