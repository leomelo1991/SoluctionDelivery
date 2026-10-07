import { createApplication } from './app.js';
import { config } from './config.js';
const { app } = await createApplication();
await app.listen(config.PORT, '0.0.0.0');
