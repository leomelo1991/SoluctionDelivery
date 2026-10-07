import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Courier, Offer } from '@solution/contracts';
import { nextOffer, offerKey } from '../src/core/offers';
import {
  observeLocation,
  validPosition,
  type LocationPort,
  type TrackingState,
} from '../src/core/location';
const profile: Courier = {
  id: 'courier',
  name: 'Demo',
  phone: '00000000',
  vehicle: 'motorcycle',
  approvalStatus: 'approved',
  availabilityStatus: 'available',
};
const offer = (
  id: string,
  code: number,
  status: Offer['status'] = 'waiting',
  version = 1,
): Offer => ({
  id,
  code,
  status,
  version,
  courierPayoutCents: 800,
  pickupAddress: {
    street: 'Rua teste',
    number: '1',
    district: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01001000',
  },
  pickupReady: true,
  manualDistanceM: null,
  distanceSource: null,
  destinationRegion: { district: 'Centro', city: 'São Paulo' },
  establishment: { name: 'Loja' },
});
test('dispatch prioritizes directed offers and preserves the visible open offer during polling', () => {
  const first = offer('first', 1);
  const second = offer('second', 2);
  const directed = offer('directed', 3, 'assigned');
  assert.equal(nextOffer([second, first], profile, false, new Set())?.id, 'first');
  assert.equal(nextOffer([first, second], profile, false, new Set(), 'second')?.id, 'second');
  assert.equal(nextOffer([first, directed], profile, false, new Set(), 'first')?.id, 'directed');
});
test('responded offers do not repeat from cached data; a new directed assignment can be received', () => {
  const original = offer('first', 1);
  const second = offer('second', 2);
  const handled = new Set([offerKey(original)]);
  assert.equal(nextOffer([original, second], profile, false, handled)?.id, 'second');
  assert.equal(nextOffer([offer('first', 1, 'assigned', 3)], profile, false, handled)?.version, 3);
});
test('dispatch blocks paused, pending, offline and active couriers, while allowing a busy directed reservation', () => {
  const waiting = offer('waiting', 1);
  const directed = offer('assigned', 2, 'assigned');
  for (const state of [
    { ...profile, approvalStatus: 'paused' },
    { ...profile, approvalStatus: 'pending' },
    { ...profile, availabilityStatus: 'offline' },
  ])
    assert.equal(nextOffer([waiting, directed], state, false, new Set()), null);
  assert.equal(nextOffer([waiting, directed], profile, true, new Set()), null);
  assert.equal(
    nextOffer([waiting, directed], { ...profile, availabilityStatus: 'busy' }, false, new Set())
      ?.id,
    'assigned',
  );
  assert.equal(
    nextOffer([waiting], { ...profile, availabilityStatus: 'busy' }, false, new Set()),
    null,
  );
});
test('withdrawn offers disappear and updates use the latest version for a decision', () => {
  const old = offer('first', 1);
  const current = offer('first', 1, 'waiting', 2);
  assert.equal(nextOffer([], profile, false, new Set(), old.id), null);
  assert.equal(nextOffer([current], profile, false, new Set(), old.id)?.version, 2);
});
test('location refuses stale, invalid and future coordinates instead of inventing a position', () => {
  const now = Date.now();
  const sample = { coords: { latitude: -23.55, longitude: -46.63, accuracy: 12 }, timestamp: now };
  assert.equal(validPosition(sample, now)?.latitude, -23.55);
  assert.equal(validPosition({ ...sample, timestamp: now - 31000 }, now), null);
  assert.equal(validPosition({ ...sample, timestamp: now + 10000 }, now), null);
  assert.equal(
    validPosition({ ...sample, coords: { ...sample.coords, latitude: 100 } }, now),
    null,
  );
  assert.equal(
    validPosition({ ...sample, coords: { ...sample.coords, longitude: Number.NaN } }, now),
    null,
  );
});
const granted = { granted: true, status: 'granted', canAskAgain: true };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function port(overrides: Partial<LocationPort> = {}): LocationPort {
  return {
    permission: async () => granted,
    requestPermission: async () => granted,
    enabled: async () => true,
    watch: async () => ({ remove: () => undefined }),
    ...overrides,
  };
}
test('denied permission and disabled GPS do not start a watcher', async () => {
  for (const denied of [true, false]) {
    const states: TrackingState[] = [];
    let watched = false;
    const stop = observeLocation(
      port({
        permission: async () =>
          denied ? { granted: false, status: 'denied', canAskAgain: false } : granted,
        enabled: async () => false,
        watch: async () => {
          watched = true;
          return { remove: () => undefined };
        },
      }),
      (state) => states.push(state),
    );
    await tick();
    stop();
    assert.equal(watched, false);
    assert.equal(states.at(-1)?.status, denied ? 'denied' : 'disabled');
  }
});
test('foreground watcher releases subscriptions and ignores callbacks after stopping', async () => {
  const states: TrackingState[] = [];
  let removed = false;
  let emit: ((sample: Parameters<typeof validPosition>[0]) => void) | undefined;
  const stop = observeLocation(
    port({
      watch: async (callback) => {
        emit = callback;
        return {
          remove: () => {
            removed = true;
          },
        };
      },
    }),
    (state) => states.push(state),
  );
  await tick();
  const sample = {
    coords: { latitude: -23.55, longitude: -46.63, accuracy: 10 },
    timestamp: Date.now(),
  };
  emit?.(sample);
  assert.equal(states.at(-1)?.status, 'ready');
  stop();
  emit?.(sample);
  assert.equal(removed, true);
  assert.equal(states.length, 2);
});
test('subscription arriving after unmount is immediately removed', async () => {
  let finish: ((subscription: { remove: () => void }) => void) | undefined;
  let removed = false;
  const stop = observeLocation(
    port({
      watch: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    }),
    () => undefined,
  );
  await tick();
  stop();
  finish?.({
    remove: () => {
      removed = true;
    },
  });
  await tick();
  assert.equal(removed, true);
});
test('recent cached GPS locates the courier before the watcher emits its first fix', async () => {
  const states: TrackingState[] = [];
  const sample = {
    coords: { latitude: -23.55, longitude: -46.63, accuracy: 10 },
    timestamp: Date.now(),
  };
  const stop = observeLocation(port({ lastKnown: async () => sample }), (state) =>
    states.push(state),
  );
  await tick();
  stop();
  assert.equal(states.at(-1)?.status, 'ready');
  assert.equal(states.at(-1)?.position?.timestamp, sample.timestamp);
});
test('a delayed cached GPS fix cannot replace a newer live position', async () => {
  const states: TrackingState[] = [];
  let finish: ((sample: Parameters<typeof validPosition>[0]) => void) | undefined;
  const now = Date.now();
  const stop = observeLocation(
    port({
      lastKnown: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      watch: async (receive) => {
        receive({ coords: { latitude: -23.55, longitude: -46.63, accuracy: 10 }, timestamp: now });
        return { remove: () => undefined };
      },
    }),
    (state) => states.push(state),
  );
  await tick();
  finish?.({ coords: { latitude: -22, longitude: -45, accuracy: 10 }, timestamp: now - 1000 });
  await tick();
  stop();
  assert.equal(states.at(-1)?.position?.latitude, -23.55);
  assert.equal(states.length, 2);
});
test('stale cached GPS and fixes arriving after stopping never display a courier', async () => {
  for (const late of [false, true]) {
    const states: TrackingState[] = [];
    let finish: ((sample: Parameters<typeof validPosition>[0]) => void) | undefined;
    const stop = observeLocation(
      port({
        lastKnown: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      }),
      (state) => states.push(state),
    );
    await tick();
    if (late) stop();
    finish?.({
      coords: { latitude: -23.55, longitude: -46.63, accuracy: 10 },
      timestamp: Date.now() - (late ? 0 : 31000),
    });
    await tick();
    stop();
    assert.equal(states.length, 1);
    assert.equal(states[0].status, 'loading');
  }
});
