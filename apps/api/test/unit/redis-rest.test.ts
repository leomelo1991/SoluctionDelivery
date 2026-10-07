import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RedisRest } from '../../src/modules/redis-rest.js';
import { RateLimiter } from '../../src/http/security.js';
const endpoint = 'https://cache.example.test';
test('Upstash sends one authenticated atomic command without putting credentials in the URL', async () => {
  const redis = new RedisRest(endpoint, 'test-token', async (url, init) => {
    assert.equal(url, endpoint);
    assert.equal(init?.redirect, 'error');
    assert.equal(init?.cache, 'no-store');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-token');
    assert.deepEqual(JSON.parse(String(init?.body)), [
      'EVAL',
      'increment-and-expire',
      1,
      'tenant:user',
    ]);
    return new Response(JSON.stringify({ result: 1 }));
  });
  assert.equal(await redis.eval('increment-and-expire', 1, 'tenant:user'), 1);
});
test('Upstash failures and malformed counters fail closed without repeating an uncertain increment', async () => {
  const replies = [
    null,
    { result: null },
    { result: '1' },
    { result: 0 },
    { result: -1 },
    { error: 'sensitive-provider-error' },
  ];
  for (const reply of replies) {
    let calls = 0;
    const redis = new RedisRest(endpoint, 'test-token', async () => {
      calls++;
      return new Response(JSON.stringify(reply));
    });
    await assert.rejects(redis.eval('increment', 1, 'user'), { status: 503 });
    assert.equal(calls, 1);
  }
  let calls = 0;
  const redis = new RedisRest(endpoint, 'test-token', async () => {
    calls++;
    throw new Error('network-failed-after-send');
  });
  await assert.rejects(redis.eval('increment', 1, 'user'), { status: 503 });
  assert.equal(calls, 1);
});
test('readiness requires actual PONG and endpoint validation prevents insecure credential requests', async () => {
  for (const result of ['PONG', 'OK', null]) {
    const redis = new RedisRest(endpoint, 'test-token', async (_url, init) => {
      assert.deepEqual(JSON.parse(String(init?.body)), ['PING']);
      return new Response(JSON.stringify({ result }));
    });
    if (result === 'PONG') assert.equal(await redis.ping(), 'PONG');
    else await assert.rejects(redis.ping(), { status: 503 });
  }
  for (const url of [
    'http://cache.example.test',
    'https://user:pass@cache.example.test',
    'https://cache.example.test?token=x',
  ])
    assert.throws(() => new RedisRest(url, 'test-token'));
});
test('HTTP Redis retains the rate limit threshold instead of allowing excessive requests', async () => {
  let count = 0;
  const redis = new RedisRest(endpoint, 'test-token', async (_url, init) => {
    const command = JSON.parse(String(init?.body));
    assert.equal(command[0], 'EVAL');
    assert.match(command[1], /INCR/);
    assert.match(command[1], /EXPIRE/);
    assert.equal(command[3], 'sd:tenant:user');
    return new Response(JSON.stringify({ result: ++count }));
  });
  const limiter = new RateLimiter();
  limiter.redis.disconnect();
  Object.defineProperty(limiter, 'redis', { value: redis });
  await limiter.hit('tenant:user', 2);
  await limiter.hit('tenant:user', 2);
  await assert.rejects(limiter.hit('tenant:user', 2), { status: 429 });
});
