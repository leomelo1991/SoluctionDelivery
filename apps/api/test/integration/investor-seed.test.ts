import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Database } from '../../src/database.js';
import { seedInvestors } from '../../scripts/investor-data.js';
import { cleanup } from '../fixtures.js';

test('investor dataset has consistent histories, assignments and repeatable financial totals', async () => {
  const db = new Database();
  const slug = 'test-investors-' + randomUUID();
  const now = new Date();
  try {
    assert.equal(await seedInvestors(db, 'test-investors-password', slug, now), true);
    const tenant = await db.tenant.findUniqueOrThrow({ where: { slug } });
    const where = { tenantId: tenant.id };
    assert.equal(await db.establishment.count({ where }), 10);
    assert.equal(await db.courier.count({ where }), 14);
    assert.equal(await db.region.count({ where }), 5);
    assert.equal(await db.cRMNote.count({ where }), 10);
    assert.equal(tenant.name, 'Franca–SP — apresentação fictícia');
    for (const store of await db.establishment.findMany({ where })) {
      assert.equal(store.city, 'Franca');
      assert.equal((store.address as { city: string }).city, 'Franca');
      assert.ok(store.phone.startsWith('16'));
    }
    for (const region of await db.region.findMany({ where })) assert.equal(region.city, 'Franca');
    for (const courier of await db.courier.findMany({ where }))
      assert.ok(courier.phone.startsWith('16'));
    const deliveries = await db.delivery.findMany({
      where,
      include: { events: { orderBy: { createdAt: 'asc' } }, offers: true },
    });
    assert.ok(deliveries.length > 500);
    const active = deliveries.filter((d) => !['waiting', 'delivered'].includes(d.status));
    assert.equal(active.length, 8);
    assert.equal(new Set(active.map((d) => d.courierId)).size, 8);
    const counts = new Set(deliveries.map((d) => d.status));
    assert.equal(counts.size, 6);
    for (const d of deliveries) {
      assert.equal((d.pickupAddress as { city: string }).city, 'Franca');
      assert.equal((d.destinationAddress as { city: string }).city, 'Franca');
      assert.ok(d.updatedAt <= now);
      assert.ok(d.feeCents >= d.courierPayoutCents);
      assert.equal(d.events.length, d.version);
      assert.equal(d.events.at(-1)?.newStatus, d.status);
      assert.equal(d.events.at(-1)?.createdAt.getTime(), d.updatedAt.getTime());
      assert.equal(d.offers.length, d.courierId ? 1 : 0);
    }
    const totals = await db.delivery.aggregate({ where, _sum: { feeCents: true } });
    assert.equal(await seedInvestors(db, 'different-password-123', slug), false);
    assert.equal(await db.delivery.count({ where }), deliveries.length);
    assert.deepEqual(await db.delivery.aggregate({ where, _sum: { feeCents: true } }), totals);
  } finally {
    const tenant = await db.tenant.findUnique({ where: { slug } });
    if (tenant) await cleanup(db, tenant.id);
    await db.$disconnect();
  }
});
