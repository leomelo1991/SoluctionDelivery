import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { RateLimiter } from '../../src/http/security.js';
class FakeRedis extends EventEmitter {
  status = 'wait';
  connects = 0;
  evaluations = 0;
  release?: () => void;
  connect() {
    this.connects++;
    this.status = 'connecting';
    return new Promise<void>((resolve) => {
      this.release = () => {
        this.status = 'ready';
        this.emit('ready');
        resolve();
      };
    });
  }
  async eval() {
    assert.equal(this.status, 'ready', 'rate-limit commands must wait for the connection');
    this.evaluations++;
    return 1;
  }
}
function fixture(redis: FakeRedis) {
  const limiter = new RateLimiter();
  limiter.redis.disconnect();
  Object.defineProperty(limiter, 'redis', { value: redis });
  return limiter;
}
test('concurrent cold requests share one Redis connection before rate-limit commands', async () => {
  const redis = new FakeRedis();
  const limiter = fixture(redis);
  const requests = Array.from({ length: 10 }, (_, index) => limiter.hit(`user-${index}`, 180));
  assert.equal(redis.connects, 1);
  assert.equal(redis.evaluations, 0);
  redis.release?.();
  await Promise.all(requests);
  assert.equal(redis.evaluations, 10);
});
test('readiness waits for an existing reconnect and releases its event listeners', async () => {
  const redis = new FakeRedis();
  redis.status = 'connecting';
  const limiter = fixture(redis);
  const requests = [limiter.ready(), limiter.hit('user', 180)];
  assert.equal(redis.connects, 0);
  redis.status = 'ready';
  redis.emit('ready');
  await Promise.all(requests);
  assert.equal(redis.evaluations, 1);
  assert.equal(redis.listenerCount('ready'), 0);
  assert.equal(redis.listenerCount('error'), 0);
});
