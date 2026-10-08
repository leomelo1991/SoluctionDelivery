import { config } from '../src/config.js';
import { RateLimiter } from '../src/http/security.js';
const namespace = process.env.SD_E2E_RATE_NAMESPACE;
if (config.NODE_ENV !== 'test' || !namespace?.startsWith('test-e2e-'))
  throw new Error('Refusing to touch non-test rate limits');
const limiter = new RateLimiter();
try {
  await limiter.ready();
  const keys = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].map(
    (ip) => `${namespace}:public:${ip}:login`,
  );
  await limiter.redis.eval("redis.call('DEL', unpack(KEYS)); return 1", keys.length, ...keys);
} finally {
  await limiter.onModuleDestroy();
}
