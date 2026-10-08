import { RateLimiter } from '../../src/http/security.js';
import { randomUUID } from 'node:crypto';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApplication } from '../../src/app.js';
import { Database } from '../../src/database.js';
import { config } from '../../src/config.js';
import { OperationsMapController, mapAddressHash } from '../../src/modules/operations-map.js';
import { fixture, cleanup, address, testPassword } from '../fixtures.js';
import type { AuthRequest } from '../../src/http/security.js';
let app: INestApplication, db: Database, f: Awaited<ReturnType<typeof fixture>>, other: typeof f;
type Session = { cookie: string; csrf: string };
let admin: Session, shop: Session, courier: Session, outsider: Session;
const get = (s: Session) =>
  request(app.getHttpServer()).get('/api/v1/operations-map').set('Cookie', s.cookie);
const post = (s: Session, path: string, body: object) =>
  request(app.getHttpServer())
    .post('/api/v1/operations-map' + path)
    .set('Cookie', s.cookie)
    .set('Origin', config.APP_ORIGIN)
    .set('X-CSRF-Token', s.csrf)
    .send(body);
async function login(slug: string, email: string) {
  const r = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('Origin', config.APP_ORIGIN)
    .send({ tenant: slug, email, password: testPassword })
    .expect(201);
  return { cookie: r.headers['set-cookie'][0].split(';')[0], csrf: r.body.csrfToken };
}
before(async () => {
  app = (await createApplication()).app;
  await app.init();
  app.get(RateLimiter).namespace = 'test-operations-map-' + randomUUID();
  db = app.get(Database);
  f = await fixture(db);
  other = await fixture(db);
  admin = await login(f.tenant.slug, f.admin.email);
  shop = await login(f.tenant.slug, f.operator.email);
  courier = await login(f.tenant.slug, f.courierUser.email);
  outsider = await login(other.tenant.slug, other.admin.email);
});
after(async () => {
  if (f) await cleanup(db, f.tenant.id);
  if (other) await cleanup(db, other.tenant.id);
  await app?.close();
});
test('GPS validates freshness and owner, rejects replay and restricts map by tenant and delivery', async () => {
  const sample = { latitude: -20.54, longitude: -47.4, accuracy: 9, observedAt: Date.now() - 1000 };
  await post(admin, '/location', sample).expect(403);
  await post(shop, '/location', sample).expect(403);
  await post(courier, '/location', { ...sample, latitude: 91 }).expect(400);
  await post(courier, '/location', { ...sample, observedAt: Date.now() - 31000 }).expect(400);
  await post(courier, '/location', { ...sample, observedAt: Date.now() + 60000 }).expect(400);
  await post(courier, '/location', { ...sample, courierId: f.second.id }).expect(400);
  assert.equal((await post(courier, '/location', sample).expect(201)).body.accepted, true);
  assert.equal(
    (
      await post(courier, '/location', {
        ...sample,
        latitude: 5,
        observedAt: sample.observedAt - 1,
      }).expect(201)
    ).body.accepted,
    false,
  );
  const overview = await get(admin).expect(200);
  assert.equal(overview.headers['cache-control'], 'no-store');
  assert.equal(overview.body.couriers[0].point.latitude, sample.latitude);
  assert.equal(overview.body.couriers[0].id, f.courier.id);
  assert.equal(overview.body.pins.length, 2);
  assert.equal((await get(shop)).body.couriers.length, 0);
  const foreign = (await get(outsider)).body;
  assert.equal(foreign.couriers.length, 0);
  assert.ok(foreign.pins.every((p: { id: string }) => !p.id.includes(f.store.id)));
  await get(courier).expect(403);
  const delivery = await db.delivery.create({
    data: {
      tenantId: f.tenant.id,
      establishmentId: f.store.id,
      courierId: f.courier.id,
      status: 'accepted',
      pickupAddress: address,
      destinationAddress: { ...address, number: '500' },
      recipientName: 'Destinatário reservado',
      recipientPhone: '11999999999',
      feeCents: 1000,
      courierPayoutCents: 800,
      pricingSnapshot: {},
    },
  });
  let scoped = (await get(shop).expect(200)).body;
  assert.equal(scoped.couriers.length, 1);
  assert.equal(scoped.couriers[0].leg, 'pickup');
  assert.equal(scoped.pins.length, 3);
  assert.ok(!JSON.stringify(scoped).includes('Destinatário reservado'));
  assert.ok(
    scoped.pins.find((p: { kind: string; active: boolean }) => p.kind === 'pickup' && p.active),
  );
  // Outra loja da mesma plataforma, com entrega e entregador online próprios.
  const otherDelivery = await db.delivery.create({
    data: {
      tenantId: f.tenant.id,
      establishmentId: f.otherStore.id,
      courierId: f.second.id,
      status: 'accepted',
      pickupAddress: { ...address, number: '700' },
      destinationAddress: { ...address, number: '800' },
      recipientName: 'Outra entrega',
      recipientPhone: '11999999999',
      feeCents: 1000,
      courierPayoutCents: 800,
      pricingSnapshot: {},
    },
  });
  await db.courierPosition.create({
    data: {
      tenantId: f.tenant.id,
      courierId: f.second.id,
      latitude: -20.55,
      longitude: -47.41,
      accuracy: 9,
      observedAt: new Date(),
    },
  });
  try {
    const all = (await get(admin).expect(200)).body;
    assert.ok(all.pins.some((p: { id: string }) => p.id.includes(otherDelivery.id)));
    assert.ok(all.couriers.some((c: { id: string }) => c.id === f.second.id));
    // Nem um parâmetro manipulado pode ampliar o escopo da sessão do lojista.
    const own = (await get(shop).query({ establishmentId: f.otherStore.id }).expect(200)).body;
    assert.deepEqual(
      own.pins
        .filter((p: { kind: string }) => p.kind === 'establishment')
        .map((p: { id: string }) => p.id),
      [`establishment:${f.store.id}`],
    );
    assert.equal(own.pins.length, 3);
    assert.ok(!JSON.stringify(own).includes(otherDelivery.id));
    assert.ok(!JSON.stringify(own).includes(f.otherStore.id));
    assert.deepEqual(
      own.couriers.map((c: { id: string }) => c.id),
      [f.courier.id],
    );
  } finally {
    await db.delivery.delete({ where: { id: otherDelivery.id } });
    await db.courierPosition.deleteMany({ where: { courierId: f.second.id } });
  }
  await db.delivery.update({ where: { id: delivery.id }, data: { status: 'collected' } });
  scoped = (await get(shop)).body;
  assert.equal(scoped.couriers[0].leg, 'dropoff');
  assert.ok(
    scoped.pins.find((p: { kind: string; active: boolean }) => p.kind === 'dropoff' && p.active),
  );
  await db.delivery.update({ where: { id: delivery.id }, data: { status: 'delivered' } });
  assert.equal((await get(shop)).body.couriers.length, 0);
  await db.courier.update({ where: { id: f.courier.id }, data: { availabilityStatus: 'offline' } });
  assert.equal((await get(admin)).body.couriers.length, 0);
  assert.equal(
    (await post(courier, '/location', { ...sample, observedAt: Date.now() }).expect(201)).body
      .accepted,
    false,
  );
  await db.courier.update({
    where: { id: f.courier.id },
    data: { availabilityStatus: 'available' },
  });
  await db.courierPosition.updateMany({
    where: { courierId: f.courier.id },
    data: { observedAt: new Date(Date.now() - 31000) },
  });
  assert.equal((await get(admin)).body.couriers.length, 0);
  await db.establishment.update({ where: { id: f.store.id }, data: { operationOpen: false } });
  assert.equal((await get(shop)).body.pins[0].active, false);
});
test('geocoding uses scoped addresses, a shared cache/lease and invalidates changed addresses', async () => {
  const controller = app.get(OperationsMapController);
  const req = { actor: f.operator } as unknown as AuthRequest;
  const originalFetch = globalThis.fetch,
    originalKey = config.GOOGLE_MAPS_KEY;
  config.GOOGLE_MAPS_KEY = 'test-key';
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(
      JSON.stringify({
        status: 'OK',
        results: [{ geometry: { location: { lat: -20.5386, lng: -47.4009 } } }],
      }),
      { status: 200 },
    );
  };
  try {
    await Promise.all([controller.resolve(req), controller.resolve(req)]);
    assert.equal(calls, 1);
    await controller.resolve(req);
    assert.equal(calls, 1);
    let s = await controller.snapshot(req);
    assert.deepEqual(s.pins[0].point, { latitude: -20.5386, longitude: -47.4009 });
    await db.establishment.update({
      where: { id: f.store.id },
      data: { address: { ...address, number: '999' } },
    });
    s = await controller.snapshot(req);
    assert.equal(s.pins[0].point, null);
    globalThis.fetch = async () => {
      calls++;
      return new Response(JSON.stringify({ status: 'ZERO_RESULTS', results: [] }), { status: 200 });
    };
    await controller.resolve(req);
    assert.equal((await controller.snapshot(req)).pins[0].locationStatus, 'unavailable');
    await controller.resolve(req);
    assert.equal(calls, 2);
    await db.mapGeocode.updateMany({
      where: { tenantId: f.tenant.id, addressHash: mapAddressHash({ ...address, number: '999' }) },
      data: { expiresAt: new Date(0) },
    });
    assert.equal((await controller.snapshot(req)).pins[0].locationStatus, 'pending');
  } finally {
    globalThis.fetch = originalFetch;
    config.GOOGLE_MAPS_KEY = originalKey;
  }
});
