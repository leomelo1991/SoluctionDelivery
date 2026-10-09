import { test } from 'node:test';
import assert from 'node:assert/strict';
import { francaCep } from '../../src/modules/cep-location.js';
const valid = {
  cep: '14400320',
  state: 'SP',
  city: 'Franca',
  street: 'Rua de teste',
  neighborhood: 'Centro',
  location: { coordinates: { latitude: '-20.54', longitude: '-47.40' } },
};
test('CEP v2 accepts only matching Franca coordinates and never invents missing points', async () => {
  const original = fetch;
  try {
    globalThis.fetch = async (input) => {
      assert.equal(String(input), 'https://brasilapi.com.br/api/cep/v2/14400320');
      return new Response(JSON.stringify(valid));
    };
    assert.deepEqual((await francaCep('14400-320'))?.point, { latitude: -20.54, longitude: -47.4 });
    for (const value of [
      { ...valid, city: 'Outra cidade' },
      { ...valid, cep: '14400100' },
      { ...valid, location: { coordinates: {} } },
      { ...valid, location: { coordinates: { latitude: '', longitude: '' } } },
      { ...valid, location: { coordinates: { latitude: 0, longitude: 0 } } },
    ]) {
      globalThis.fetch = async () => new Response(JSON.stringify(value));
      assert.equal(await francaCep('14400320'), null);
    }
    globalThis.fetch = async () => new Response('{}', { status: 429 });
    assert.equal(await francaCep('14400320'), null);
    assert.equal(await francaCep('01001000'), null);
  } finally {
    globalThis.fetch = original;
  }
});
