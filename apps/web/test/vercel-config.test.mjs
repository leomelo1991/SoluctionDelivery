import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { validateDeployment } from '../scripts/validate-vercel.mjs';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('Vercel receives static JSON with all required rewrite destinations', () => {
  for (const name of ['vercel.ts', 'vercel.mjs'])
    assert.equal(existsSync(new URL('../' + name, import.meta.url)), false);
  for (const rule of config.rewrites) {
    assert.equal(typeof rule.source, 'string');
    assert.equal(typeof rule.destination, 'string');
    assert.ok(rule.destination.length > 0);
    assert.ok(!rule.destination.includes('${'));
  }
  assert.ok(validateDeployment(config, {}).startsWith('https://'));
});

test('API proxy preserves its path prefix and SPA fallback excludes API and assets', () => {
  assert.ok(config.rewrites[0].destination.endsWith('/api/:path*'));
  const pattern = new RegExp(`^${config.rewrites[1].source}$`);
  for (const path of ['/api/v1/me', '/api/v1/auth/login', '/assets/index.js'])
    assert.equal(pattern.test(path), false);
  assert.equal(pattern.test('/admin/estabelecimentos'), true);
  assert.equal(config.rewrites[1].destination, '/index.html');
  assert.equal(config.headers[0].headers[0].value, 'no-store');
});

test('deployment refuses an API proxy pointing back to the frontend itself', () => {
  const hostname = new URL(validateDeployment(config, {})).host;
  for (const name of ['VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL'])
    assert.throws(() => validateDeployment(config, { [name]: hostname }), /próprio painel/);
  assert.doesNotThrow(() =>
    validateDeployment(config, {
      VERCEL_PROJECT_PRODUCTION_URL: 'different-frontend.example.test',
      VERCEL_URL: 'preview-frontend.example.test',
    }),
  );
});

test('missing or malformed API destinations fail before deployment', () => {
  for (const destination of [
    undefined,
    '',
    'http://backend.example.test/api/:path*',
    'https://user:password@backend.example.test/api/:path*',
    'https://backend.example.test/extra/api/:path*',
    'https://backend.example.test?key=placeholder/api/:path*',
  ])
    assert.throws(() =>
      validateDeployment({ rewrites: [{ source: '/api/:path*', destination }] }, {}),
    );
});
