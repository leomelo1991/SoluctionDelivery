import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Delivery } from '@solution/contracts';
import {
  latestDelivery,
  navigationLink,
  navigationTarget,
  shouldRefreshRoute,
} from '../src/core/navigation';
const pickup = {
  street: 'Rua da loja',
  number: '10',
  district: 'Centro',
  city: 'São Paulo',
  state: 'SP',
  postalCode: '01001000',
};
const base = {
  id: 'one',
  status: 'accepted',
  version: 2,
  pickupAddress: pickup,
  destinationAddress: { ...pickup, street: 'Rua do cliente' },
  establishment: { id: 'store', name: 'Loja' },
  recipientName: 'Cliente',
} as Delivery;
test('navigation follows pickup until collection, then switches to destination and clears after completion', () => {
  for (const status of ['accepted', 'arrived'] as const)
    assert.equal(navigationTarget({ ...base, status })?.address.street, pickup.street);
  assert.equal(
    navigationTarget({ ...base, status: 'collected' })?.address.street,
    'Rua do cliente',
  );
  for (const status of ['waiting', 'assigned', 'delivered'] as const)
    assert.equal(navigationTarget({ ...base, status }), null);
  assert.notEqual(
    navigationTarget(base)?.key,
    navigationTarget({ ...base, version: 4, status: 'collected' })?.key,
  );
});
test('stale polling cannot undo a confirmed collection or resurrect a completed delivery', () => {
  const collected = { ...base, version: 4, status: 'collected' } as Delivery;
  const completed = { ...base, version: 5, status: 'delivered' } as Delivery;
  assert.equal(latestDelivery(base, collected)?.status, 'collected');
  assert.equal(latestDelivery(collected, completed)?.status, 'delivered');
  assert.equal(latestDelivery(undefined, completed)?.status, 'delivered');
  assert.equal(latestDelivery(completed, collected)?.version, 5);
  assert.equal(latestDelivery({ ...base, id: 'new' }, completed)?.id, 'new');
});
test('GPS jitter and frequent samples do not create repeated route requests', () => {
  const origin = { latitude: -23.55, longitude: -46.63 };
  const previous = { origin, requestedAt: 1000 };
  assert.equal(shouldRefreshRoute(previous, origin, 61000), false);
  assert.equal(shouldRefreshRoute(previous, { ...origin, latitude: -23.55001 }, 61000), false);
  assert.equal(shouldRefreshRoute(previous, { ...origin, latitude: -23.56 }, 2000), false);
  assert.equal(shouldRefreshRoute(previous, { ...origin, latitude: -23.56 }, 61000), true);
});
test('external navigation changes to delivery address only after confirmed collection', () => {
  const pickupLink = new URL(navigationLink(base)!);
  assert.match(pickupLink.searchParams.get('destination')!, /Rua da loja/);
  const dropoff = new URL(
    navigationLink({ ...base, status: 'collected' }, { latitude: -23, longitude: -46 })!,
  );
  assert.match(dropoff.searchParams.get('destination')!, /Rua do cliente/);
  assert.equal(dropoff.searchParams.get('origin'), '-23,-46');
  assert.equal(navigationLink({ ...base, status: 'delivered' }), null);
});
