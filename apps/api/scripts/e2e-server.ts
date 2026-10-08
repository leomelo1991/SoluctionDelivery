import { createApplication } from '../src/app.js';
import { config } from '../src/config.js';
import { RateLimiter } from '../src/http/security.js';
const namespace = process.env.SD_E2E_RATE_NAMESPACE;
if (config.NODE_ENV !== 'test' || !namespace?.startsWith('test-e2e-'))
  throw new Error('E2E server requires isolated test configuration');
const { app } = await createApplication();
app.get(RateLimiter).namespace = namespace;
await app.listen(config.PORT, '127.0.0.1');
