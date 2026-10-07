import type { Courier, Offer } from '@solution/contracts';
export const offerKey = (offer: Pick<Offer, 'id' | 'version'>) => `${offer.id}:${offer.version}`;
export function nextOffer(
  items: Offer[],
  profile: Courier | undefined,
  hasActiveDelivery: boolean,
  handled: ReadonlySet<string>,
  currentId?: string,
): Offer | null {
  if (
    !profile ||
    profile.approvalStatus !== 'approved' ||
    profile.availabilityStatus === 'offline' ||
    hasActiveDelivery
  )
    return null;
  const eligible = items.filter(
    (o) =>
      !handled.has(offerKey(o)) &&
      (o.status === 'assigned' ||
        (o.status === 'waiting' && profile.availabilityStatus === 'available')),
  );
  const directed = eligible.filter((o) => o.status === 'assigned').sort((a, b) => a.code - b.code);
  if (directed.length) return directed.find((o) => o.id === currentId) ?? directed[0];
  return (
    eligible.find((o) => o.id === currentId) ?? eligible.sort((a, b) => a.code - b.code)[0] ?? null
  );
}
