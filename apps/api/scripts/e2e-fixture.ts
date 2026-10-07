import { writeFile, readFile } from 'node:fs/promises';
import { Database } from '../src/database.js';
import { config } from '../src/config.js';
import { fixture, cleanup } from '../test/fixtures.js';
if (config.NODE_ENV === 'production') throw new Error('E2E fixtures are forbidden in production');
const db = new Database();
try {
  if (process.argv[2] === 'cleanup') {
    const f = JSON.parse(await readFile('../../test-results/fixture.json', 'utf8'));
    await cleanup(db, f.tenant.id);
  } else {
    const f = await fixture(db, 'e2e-' + Date.now());
    await writeFile('../../test-results/fixture.json', JSON.stringify(f));
  }
} finally {
  await db.$disconnect();
}
