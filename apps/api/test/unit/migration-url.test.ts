import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrationDatabaseUrl } from '../../scripts/migration-url.js';

test('Prisma prefers direct database aliases without changing the application URL', () => {
  const env = {
    DATABASE_URL: 'postgresql://db-pooler.example.test/database',
    DATABASE_URL_UNPOOLED: 'postgresql://db.example.test/database?sslmode=require',
    DIRECT_URL: 'postgresql://direct.example.test/database',
    POSTGRES_URL_NON_POOLING: 'postgresql://non-pooling.example.test/database',
  };
  assert.equal(migrationDatabaseUrl(env), env.DATABASE_URL_UNPOOLED);
  assert.equal(env.DATABASE_URL, 'postgresql://db-pooler.example.test/database');
  assert.equal(migrationDatabaseUrl({ ...env, DATABASE_URL_UNPOOLED: '' }), env.DIRECT_URL);
  assert.equal(
    migrationDatabaseUrl({ ...env, DATABASE_URL_UNPOOLED: ' ', DIRECT_URL: '' }),
    env.POSTGRES_URL_NON_POOLING,
  );
  assert.equal(migrationDatabaseUrl({ DATABASE_URL: env.DATABASE_URL }), env.DATABASE_URL);
  assert.match(migrationDatabaseUrl({}), /localhost:5432/);
});

import { migrationTarget } from '../../scripts/migration-diagnostics.js';

test('deployment diagnoses the effective direct host and rejects Neon pooling for migrations', () => {
  assert.throws(
    () =>
      migrationTarget({
        DATABASE_URL_UNPOOLED: 'postgresql://user:secret@ep-demo-pooler.us-east-1.aws.neon.tech/db',
      }),
    /pooler/,
  );
  const target = migrationTarget({
    DATABASE_URL_UNPOOLED:
      'postgresql://user:secret@ep-demo.us-east-1.aws.neon.tech/db?sslmode=require',
  });
  assert.equal(target.hostname, 'ep-demo.us-east-1.aws.neon.tech');
  assert.equal(target.database, 'db');
});
