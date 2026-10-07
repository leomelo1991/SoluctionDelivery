import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
loadEnv({
  path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
  quiet: true,
});
import { defineConfig } from 'prisma/config';
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://solution:solution@localhost:5432/solution',
  },
});
