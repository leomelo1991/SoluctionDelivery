import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoPassword } from '../../scripts/demo-seed.js';

test('demo requires explicit production authorization and a valid password', () => {
  const env = {
    NODE_ENV: 'production',
    ALLOW_DEMO_SEED: 'true',
    DEMO_PASSWORD: 'test-password-123',
  };
  assert.throws(() => demoPassword(env), /ALLOW_PRODUCTION_DEMO_SEED/);
  assert.equal(demoPassword({ ...env, ALLOW_PRODUCTION_DEMO_SEED: 'true' }), env.DEMO_PASSWORD);
  assert.throws(
    () => demoPassword({ ...env, NODE_ENV: 'development', ALLOW_DEMO_SEED: 'false' }),
    /ALLOW_DEMO_SEED/,
  );
  assert.throws(
    () => demoPassword({ ...env, ALLOW_PRODUCTION_DEMO_SEED: 'true', DEMO_PASSWORD: 'short' }),
    /12 a 128/,
  );
});
