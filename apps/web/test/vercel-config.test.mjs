import { test } from 'node:test';
import assert from 'node:assert/strict';
const module = new URL('../vercel.mjs', import.meta.url).href;
let attempt = 0;
async function load(origin) {
  const previous = process.env.API_ORIGIN;
  process.env.API_ORIGIN = origin;
  try {
    return (await import(`${module}?test=${attempt++}`)).config;
  } finally {
    if (previous === undefined) delete process.env.API_ORIGIN;
    else process.env.API_ORIGIN = previous;
  }
}
test('API requests retain the backend prefix and SPA fallback never catches API/assets', async () => {
  const config = await load('https://backend.example.test');
  assert.equal(config.rewrites[0].destination, 'https://backend.example.test/api/:path*');
  const pattern = new RegExp(`^${config.rewrites[1].source}$`);
  for (const path of ['/api/v1/me', '/api/v1/auth/login', '/assets/index.js'])
    assert.equal(pattern.test(path), false);
  assert.equal(pattern.test('/crm/estabelecimentos'), true);
  assert.equal(config.headers[0].headers[0].value, 'no-store');
});
test('deployment fails without an HTTPS backend origin instead of publishing a broken proxy', async () => {
  for (const origin of [
    '',
    'http://backend.example.test',
    'https://user:password@backend.example.test',
    'https://backend.example.test/api/v1',
    'https://backend.example.test?token=placeholder',
  ]) {
    await assert.rejects(load(origin));
  }
});
