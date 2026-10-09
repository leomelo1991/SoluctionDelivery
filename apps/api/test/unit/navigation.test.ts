import { OpenRouteServiceProvider } from '../../src/modules/openrouteservice.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NavigationService } from '../../src/modules/navigation.js';
import { GoogleProvider } from '../../src/modules/routing.js';
import type { Database } from '../../src/database.js';
import type { Actor } from '../../src/http/security.js';
const actor: Actor = {
  id: 'user',
  tenantId: 'company',
  courierId: 'courier',
  establishmentId: null,
  role: 'courier',
  name: 'Courier',
  email: 'test@example.test',
  mustChangePassword: false,
};
const input = () => ({ latitude: -23.55, longitude: -46.63, timestamp: Date.now(), version: 2 });
const pickup = { street: 'Loja' };
const destination = { street: 'Cliente' };
const route = {
  provider: 'openrouteservice' as const,
  distanceM: 1200,
  durationSeconds: 240,
  coordinates: [
    { latitude: -23.55, longitude: -46.63 },
    { latitude: -23.56, longitude: -46.64 },
  ],
};
function setup(status = 'accepted', changed = false, enabled = true, missing = false) {
  let calls = 0;
  let requestedDestination: unknown;
  const db = {
    delivery: {
      findFirst: async (query: { where: object }) => {
        assert.deepEqual(query.where, {
          tenantId: actor.tenantId,
          courierId: actor.courierId,
          id: 'delivery',
        });
        calls++;
        if (missing) return null;
        return {
          status,
          version: changed && calls > 1 ? 3 : 2,
          pickupAddress: pickup,
          destinationAddress: destination,
        };
      },
    },
  } as unknown as Database;
  const google = {
    enabled,
    navigate: async (_origin: unknown, to: unknown) => {
      requestedDestination = to;
      return route;
    },
  } as unknown as OpenRouteServiceProvider;
  return { service: new NavigationService(db, google), destination: () => requestedDestination };
}
test('navigation uses authorized pickup before collection and destination after collection', async () => {
  for (const status of ['accepted', 'arrived', 'collected']) {
    const fixture = setup(status);
    const result = await fixture.service.route(actor, 'delivery', input());
    assert.equal(result.leg, status === 'collected' ? 'dropoff' : 'pickup');
    assert.deepEqual(fixture.destination(), status === 'collected' ? destination : pickup);
  }
});
test('navigation rejects inaccessible, unaccepted, completed and stale deliveries before requesting a provider', async () => {
  await assert.rejects(setup().service.route({ ...actor, role: 'admin' }, 'delivery', input()), {
    status: 403,
  });
  await assert.rejects(
    setup('accepted', false, true, true).service.route(actor, 'delivery', input()),
    { status: 404 },
  );
  for (const status of ['waiting', 'assigned', 'delivered'])
    await assert.rejects(setup(status).service.route(actor, 'delivery', input()), { status: 409 });
  await assert.rejects(setup().service.route(actor, 'delivery', { ...input(), version: 1 }), {
    status: 409,
  });
});
test('navigation discards responses when a delivery changes during the provider request', async () => {
  await assert.rejects(setup('accepted', true).service.route(actor, 'delivery', input()), {
    status: 409,
  });
});
test('navigation requires recent GPS and a configured provider, without generating a fake route', async () => {
  await assert.rejects(
    setup().service.route(actor, 'delivery', { ...input(), timestamp: Date.now() - 31000 }),
    { status: 400 },
  );
  await assert.rejects(
    setup().service.route(actor, 'delivery', { ...input(), timestamp: Date.now() + 10000 }),
    { status: 400 },
  );
  await assert.rejects(setup('accepted', false, false).service.route(actor, 'delivery', input()), {
    status: 503,
  });
});
test('Google route validates geometry and converts longitude/latitude in the correct order', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.polylineEncoding, 'GEO_JSON_LINESTRING');
      assert.deepEqual(body.origin.location.latLng, { latitude: -23.55, longitude: -46.63 });
      return new Response(
        JSON.stringify({
          routes: [
            {
              distanceMeters: 1200,
              duration: '240s',
              polyline: {
                geoJsonLinestring: {
                  type: 'LineString',
                  coordinates: [
                    [-46.63, -23.55],
                    [-46.64, -23.56],
                  ],
                },
              },
            },
          ],
        }),
      );
    };
    const provider = new GoogleProvider();
    const result = await provider.navigate(input(), {
      street: 'Loja',
      number: '1',
      district: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      postalCode: '01001000',
    });
    assert.deepEqual(result.coordinates, route.coordinates);
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          routes: [
            {
              distanceMeters: 1,
              duration: '1s',
              polyline: {
                geoJsonLinestring: {
                  type: 'LineString',
                  coordinates: [
                    [-46, 100],
                    [-46, -23],
                  ],
                },
              },
            },
          ],
        }),
      );
    await assert.rejects(
      provider.navigate(input(), {
        street: 'Loja',
        number: '1',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        postalCode: '01001000',
      }),
    );
  } finally {
    globalThis.fetch = original;
  }
});
