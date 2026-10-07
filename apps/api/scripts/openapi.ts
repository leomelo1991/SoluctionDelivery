import { writeFile } from 'node:fs/promises';
import { createApplication } from '../src/app.js';
const { app, document } = await createApplication();
await writeFile('../../packages/contracts/openapi.json', JSON.stringify(document, null, 2) + '\n');
await app.close();
