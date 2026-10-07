import type { Coordinate, Delivery } from '@solution/contracts';
import { navigationLeg } from '@solution/contracts';
export function navigationTarget(delivery?: Delivery) {
  const leg = delivery && navigationLeg(delivery.status);
  return delivery && leg
    ? {
        key: `${delivery.id}:${delivery.version}:${leg}`,
        leg,
        address: leg === 'pickup' ? delivery.pickupAddress : delivery.destinationAddress,
        label: leg === 'pickup' ? delivery.establishment.name : delivery.recipientName,
      }
    : null;
}
export function distanceBetween(a: Coordinate, b: Coordinate) {
  const radians = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * radians;
  const dLng = (b.longitude - a.longitude) * radians;
  const sin =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(sin), Math.sqrt(Math.max(0, 1 - sin)));
}
export function shouldRefreshRoute(
  previous: { origin: Coordinate; requestedAt: number },
  origin: Coordinate,
  now: number,
) {
  return now - previous.requestedAt >= 60000 && distanceBetween(previous.origin, origin) >= 100;
}
export function latestDelivery(server?: Delivery, confirmed?: Delivery) {
  if (!confirmed) return server;
  if (!server || (server.id === confirmed.id && confirmed.version >= server.version))
    return confirmed;
  return server;
}
export function navigationLink(delivery: Delivery, origin?: Coordinate) {
  const target = navigationTarget(delivery);
  if (!target) return null;
  const a = target.address;
  const query = new URLSearchParams({
    api: '1',
    destination: `${a.street}, ${a.number}, ${a.district}, ${a.city}/${a.state}, ${a.postalCode}`,
    travelmode: 'driving',
    dir_action: 'navigate',
  });
  if (origin) query.set('origin', `${origin.latitude},${origin.longitude}`);
  return `https://www.google.com/maps/dir/?${query}`;
}
