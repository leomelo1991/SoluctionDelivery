import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { Database } from '../../src/database.js';
import { seedDemo } from '../../scripts/demo-seed.js';
import { cleanup } from '../fixtures.js';

test('concurrent demo seeds create once and reruns preserve users, passwords and edits', async () => {
  const db = new Database();
  const slug = 'test-seed-' + randomUUID();
  const password = 'seed-test-password-123';
  try {
    const results = await Promise.all([seedDemo(db, password, slug), seedDemo(db, password, slug)]);
    assert.deepEqual(results.sort(), [false, true]);
    const tenant = await db.tenant.findUniqueOrThrow({ where: { slug } });
    const where = { tenantId: tenant.id };
    const users = await db.user.findMany({ where, orderBy: { email: 'asc' } });
    assert.equal(users.length, 3);
    for (const user of users) {
      assert.equal(user.mustChangePassword, true);
      assert.equal(await argon2.verify(user.passwordHash, password), true);
    }
    assert.equal(await db.establishment.count({ where }), 1);
    assert.equal(await db.courier.count({ where }), 1);
    assert.equal(await db.region.count({ where }), 1);
    assert.equal(await db.pricingConfig.count({ where }), 1);
    assert.equal(await db.auditEvent.count({ where }), 1);
    await db.tenant.update({ where: { id: tenant.id }, data: { name: 'Edited name' } });
    assert.equal(await seedDemo(db, 'different-password-123', slug), false);
    assert.deepEqual(await db.user.findMany({ where, orderBy: { email: 'asc' } }), users);
    assert.equal((await db.tenant.findUniqueOrThrow({ where: { slug } })).name, 'Edited name');
  } finally {
    const tenant = await db.tenant.findUnique({ where: { slug } });
    if (tenant) await cleanup(db, tenant.id);
    await db.$disconnect();
  }
});
