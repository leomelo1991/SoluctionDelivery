import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError, validateApiUrl } from '../src/core/client';
import { historyPeriod, nextStep } from '../src/core/delivery';
test('native client sends bearer without cookies, Origin or CSRF', async () => {
  let received: RequestInit | undefined;
  const api = new ApiClient('https://api.example.test/api/v1', {
    token: 'native-token',
    fetcher: async (_url, options) => {
      received = options;
      return Response.json({ ok: true });
    },
  });
  await api.request('/couriers/me/availability', 'PATCH', { status: 'available' });
  assert.equal(received?.credentials, 'omit');
  const headers = received?.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer native-token');
  assert.equal(headers.Origin, undefined);
  assert.equal(headers['X-CSRF-Token'], undefined);
});
test('uncertain delivery retry reuses key and success clears it', async () => {
  const keys: string[] = [];
  let attempts = 0;
  let generated = 0;
  const api = new ApiClient('https://api.example.test', {
    key: () => `key-${++generated}`,
    fetcher: async (_url, options) => {
      keys.push((options?.headers as Record<string, string>)['Idempotency-Key']);
      if (++attempts === 1) throw new Error('connection lost');
      return Response.json({ ok: true });
    },
  });
  await assert.rejects(api.request('/deliveries/1/accept', 'POST', { version: 1 }, true));
  await api.request('/deliveries/1/accept', 'POST', { version: 1 }, true);
  await api.request('/deliveries/1/accept', 'POST', { version: 1 }, true);
  assert.deepEqual(keys, ['key-1', 'key-1', 'key-2']);
});
test('expired session triggers sign out and different clients do not share token or keys', async () => {
  let expired = 0;
  const tokens: string[] = [];
  const fetcher: typeof fetch = async (_url, options) => {
    tokens.push((options?.headers as Record<string, string>).Authorization);
    return Response.json({ message: 'Sessão expirada' }, { status: 401 });
  };
  const one = new ApiClient('https://example.test', {
    token: 'one',
    fetcher,
    unauthorized: () => expired++,
  });
  const two = new ApiClient('https://example.test', { token: 'two', fetcher });
  await assert.rejects(
    one.request('/me'),
    (e: unknown) => e instanceof ApiError && e.status === 401,
  );
  await assert.rejects(two.request('/me'));
  assert.equal(expired, 1);
  assert.deepEqual(tokens, ['Bearer one', 'Bearer two']);
});
test('malformed server reply is never treated as a successful action', async () => {
  const api = new ApiClient('https://example.test', {
    fetcher: async () => new Response('<html>proxy error</html>', { status: 200 }),
  });
  await assert.rejects(
    api.request('/me'),
    (e: unknown) => e instanceof ApiError && e.status === 502,
  );
});
test('production URL requires HTTPS and rejects credentials or query', () => {
  assert.equal(
    validateApiUrl('https://example.test/api/v1/', false),
    'https://example.test/api/v1',
  );
  assert.equal(
    validateApiUrl('http://192.168.1.20:8080/api/v1', true),
    'http://192.168.1.20:8080/api/v1',
  );
  for (const value of [
    undefined,
    'http://example.test',
    'ftp://example.test',
    'https://user:password@example.test',
    'https://example.test?token=secret',
  ])
    assert.throws(() => validateApiUrl(value, false));
});
test('delivery stages and history period preserve pickup order and São Paulo dates', () => {
  assert.equal(nextStep.accepted?.action, 'arrive');
  assert.equal(nextStep.arrived?.action, 'collect');
  assert.equal(nextStep.collected?.action, 'complete');
  assert.equal(nextStep.delivered, undefined);
  assert.match(historyPeriod('2026-10-06', '2026-10-06'), /03%3A00/);
  assert.throws(() => historyPeriod('2026-02-30', '2026-03-01'));
  assert.throws(() => historyPeriod('2026-10-07', '2026-10-06'));
});
