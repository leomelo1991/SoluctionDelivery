import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browserMapsKey } from '../scripts/maps-config.ts';

test('browser key is trimmed and accepts the explicit public API_KEY alias', () => {
  assert.equal(browserMapsKey({ VITE_GOOGLE_MAPS_KEY: ' public-key\n' }), 'public-key');
  assert.equal(browserMapsKey({ VITE_GOOGLE_MAPS_API_KEY: 'public-alias' }), 'public-alias');
  assert.equal(
    browserMapsKey({ VITE_GOOGLE_MAPS_KEY: 'primary', VITE_GOOGLE_MAPS_API_KEY: 'alias' }),
    'primary',
  );
});
test('private server credentials never enable the browser map', () => {
  assert.equal(browserMapsKey({ GOOGLE_MAPS_KEY: 'private-key' }), '');
  assert.throws(
    () => browserMapsKey({ VERCEL: '1', GOOGLE_MAPS_KEY: 'private-key' }),
    /projeto frontend/,
  );
});
test('Vercel cannot silently publish a disabled map', () => {
  assert.throws(
    () => browserMapsKey({ VERCEL: '1', VITE_GOOGLE_MAPS_KEY: '  ' }),
    /Mapa sem chave/,
  );
  assert.equal(browserMapsKey({}), '');
  assert.throws(
    () => browserMapsKey({ VITE_GOOGLE_MAPS_KEY: 'VITE_GOOGLE_MAPS_KEY=value' }),
    /somente a chave/,
  );
});
