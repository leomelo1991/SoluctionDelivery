import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenRouteServiceProvider } from '../../src/modules/openrouteservice.js';
import { config } from '../../src/config.js';
const address = {
  street: 'Rua Teste',
  number: '10',
  district: 'Centro',
  city: 'Franca',
  state: 'SP',
  postalCode: '14400000',
};
const feature = {
  geometry: { type: 'Point', coordinates: [-47.4, -20.54] },
  properties: { confidence: 1, layer: 'address' },
};
test('ORS routes use longitude/latitude, private authorization and cached address lookup', async () => {
  const original = fetch,
    key = config.OPENROUTESERVICE_API_KEY;
  config.OPENROUTESERVICE_API_KEY = 'test-private-key';
  let geocodes = 0;
  try {
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.hostname, 'api.openrouteservice.org');
      if (url.pathname.includes('geocode')) {
        geocodes++;
        assert.equal(url.searchParams.get('boundary.country'), 'BRA');
        return new Response(JSON.stringify({ features: [feature] }));
      }
      assert.equal((init?.headers as Record<string, string>).Authorization, 'test-private-key');
      assert.deepEqual(JSON.parse(String(init?.body)).coordinates, [
        [-47.41, -20.55],
        [-47.4, -20.54],
      ]);
      return new Response(
        JSON.stringify({
          features: [
            {
              geometry: {
                type: 'LineString',
                coordinates: [
                  [-47.41, -20.55],
                  [-47.4, -20.54],
                ],
              },
              properties: { summary: { distance: 1234.5, duration: 123.5 } },
            },
          ],
        }),
      );
    };
    const provider = new OpenRouteServiceProvider();
    const route = await provider.navigate({ latitude: -20.55, longitude: -47.41 }, address);
    assert.equal(route.provider, 'openrouteservice');
    assert.equal(route.distanceM, 1235);
    assert.equal(route.durationSeconds, 124);
    assert.deepEqual(route.coordinates[0], { latitude: -20.55, longitude: -47.41 });
    await provider.geocode(address);
    assert.equal(geocodes, 1);
  } finally {
    globalThis.fetch = original;
    config.OPENROUTESERVICE_API_KEY = key;
  }
});
test('ORS rejects ambiguous/imprecise addresses, invalid geometry and quota errors', async () => {
  const original = fetch,
    key = config.OPENROUTESERVICE_API_KEY;
  config.OPENROUTESERVICE_API_KEY = 'test-key';
  try {
    for (const features of [
      [],
      [feature, feature],
      [{ ...feature, properties: { confidence: 0.4, layer: 'address' } }],
      [{ ...feature, properties: { confidence: 1, layer: 'locality' } }],
      [{ ...feature, geometry: { type: 'Point', coordinates: [200, 100] } }],
    ]) {
      globalThis.fetch = async () => new Response(JSON.stringify({ features }));
      await assert.rejects(new OpenRouteServiceProvider().geocode(address));
    }
    globalThis.fetch = async () => new Response('{}', { status: 429 });
    await assert.rejects(new OpenRouteServiceProvider().geocode(address), /ROUTING_UNAVAILABLE/);
    config.OPENROUTESERVICE_API_KEY = '';
    globalThis.fetch = async () => {
      throw new Error('Must not call a provider without credentials');
    };
    assert.equal(new OpenRouteServiceProvider().enabled, false);
    await assert.rejects(new OpenRouteServiceProvider().geocode(address), /ROUTING_UNAVAILABLE/);
  } finally {
    globalThis.fetch = original;
    config.OPENROUTESERVICE_API_KEY = key;
  }
});
