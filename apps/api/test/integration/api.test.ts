import { OpenRouteServiceProvider } from '../../src/modules/openrouteservice.js';
import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApplication } from '../../src/app.js';
import { Database } from '../../src/database.js';
import { RateLimiter } from '../../src/http/security.js';
import { config } from '../../src/config.js';
import { RoutingService, MapboxProvider, GoogleProvider } from '../../src/modules/routing.js';
import { fixture, cleanup, address, testPassword } from '../fixtures.js';
let app: INestApplication;
let db: Database;
let f: Awaited<ReturnType<typeof fixture>>;
let foreign: typeof f;
interface Session {
  cookie: string;
  csrf: string;
}
let admin: Session;
let operator: Session;
let courier: Session;
let second: Session;
let outsider: Session;
async function login(slug: string, email: string) {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('Origin', config.APP_ORIGIN)
    .send({ tenant: slug, email, password: testPassword })
    .expect(201);
  return {
    cookie: (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0],
    csrf: res.body.csrfToken,
  };
}
const get = (s: Session, path: string) =>
  request(app.getHttpServer())
    .get('/api/v1' + path)
    .set('Cookie', s.cookie);
const post = (s: Session, path: string, body: object, key = randomUUID()) =>
  request(app.getHttpServer())
    .post('/api/v1' + path)
    .set('Cookie', s.cookie)
    .set('Origin', config.APP_ORIGIN)
    .set('X-CSRF-Token', s.csrf)
    .set('Idempotency-Key', key)
    .send(body);
const patch = (s: Session, path: string, body: object) =>
  request(app.getHttpServer())
    .patch('/api/v1' + path)
    .set('Cookie', s.cookie)
    .set('Origin', config.APP_ORIGIN)
    .set('X-CSRF-Token', s.csrf)
    .send(body);
async function delivery() {
  const input = {
    establishmentId: f.store.id,
    destinationAddress: address,
    method: 'region',
    regionId: f.region.id,
  };
  const q = await post(operator, '/pricing/quotes', input).expect(201);
  const res = await post(operator, '/deliveries', {
    ...input,
    quoteId: q.body.id,
    recipientName: 'Cliente de teste',
    recipientPhone: '11999990009',
  }).expect(201);
  return res.body as { id: string; version: number; feeCents: number };
}
before(async () => {
  const built = await createApplication();
  app = built.app;
  await app.init();
  app.get(RateLimiter).namespace = 'test-' + randomUUID();
  db = app.get(Database);
  f = await fixture(db);
  foreign = await fixture(db);
  admin = await login(f.tenant.slug, 'admin@example.test');
  operator = await login(f.tenant.slug, 'loja@example.test');
  courier = await login(f.tenant.slug, 'entregador@example.test');
  second = await login(f.tenant.slug, 'segundo@example.test');
  outsider = await login(foreign.tenant.slug, 'admin@example.test');
});
beforeEach(() => {
  app.get(RateLimiter).namespace = 'test-' + randomUUID();
});
after(async () => {
  if (db && f) await cleanup(db, f.tenant.id);
  if (db && foreign) await cleanup(db, foreign.tenant.id);
  if (app) await app.close();
});
test('tenant and establishment scope protects data and composite foreign keys', async () => {
  await get(operator, '/establishments/' + f.otherStore.id).expect(404);
  await get(admin, '/establishments/' + foreign.store.id).expect(404);
  const list = await get(operator, '/establishments').expect(200);
  assert.equal(list.body.total, 1);
  await assert.rejects(
    db.user.create({
      data: {
        tenantId: f.tenant.id,
        name: 'Invalid',
        email: 'invalid@example.test',
        role: 'establishment',
        establishmentId: foreign.store.id,
        passwordHash: 'invalid',
      },
    }),
  );
});
test('origin and CSRF are mandatory and courier cannot create delivery', async () => {
  await request(app.getHttpServer())
    .post('/api/v1/couriers')
    .set('Cookie', admin.cookie)
    .send({})
    .expect(403);
  await request(app.getHttpServer())
    .post('/api/v1/couriers')
    .set('Cookie', admin.cookie)
    .set('Origin', config.APP_ORIGIN)
    .send({})
    .expect(403);
  await post(courier, '/deliveries', {}).expect(403);
});
test('competing couriers produce one winner, private offer and complete integrated flow', async () => {
  const d = await delivery();
  await get(outsider, '/deliveries/' + d.id).expect(404);
  const offers = await get(courier, '/couriers/me/offers').expect(200);
  const offer = offers.body.items.find((o: { id: string }) => o.id === d.id);
  assert.equal(offer.recipientName, undefined);
  assert.equal(offer.recipientPhone, undefined);
  assert.equal(offer.destinationAddress, undefined);
  assert.equal(offer.feeCents, undefined);
  const results = await Promise.all([
    post(courier, `/deliveries/${d.id}/accept`, { version: 1 }),
    post(second, `/deliveries/${d.id}/accept`, { version: 1 }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const winner = results[0].status === 201 ? courier : second;
  const cId = results[0].status === 201 ? f.courier.id : f.second.id;
  await post(admin, `/couriers/${cId}/approval-actions`, { status: 'paused' }).expect(400);
  await post(winner, `/deliveries/${d.id}/complete`, { version: 2 }).expect(409);
  await post(winner, `/deliveries/${d.id}/arrive`, { version: 2 }).expect(201);
  const key = randomUUID();
  const collect = await post(operator, `/deliveries/${d.id}/collect`, { version: 3 }, key).expect(
    201,
  );
  assert.equal(collect.body.status, 'collected');
  await post(operator, `/deliveries/${d.id}/collect`, { version: 3 }, key).expect(201);
  await post(winner, `/deliveries/${d.id}/collect`, { version: 3 }).expect(409);
  await post(operator, `/deliveries/${d.id}/complete`, { version: 4 }).expect(403);
  await post(winner, `/deliveries/${d.id}/complete`, { version: 4 }).expect(201);
  const detail = await get(operator, '/deliveries/' + d.id).expect(200);
  assert.deepEqual(
    detail.body.events.map((e: { newStatus: string }) => e.newStatus),
    ['waiting', 'accepted', 'arrived', 'collected', 'delivered'],
  );
  assert.equal(
    (await db.courier.findUniqueOrThrow({ where: { id: cId } })).availabilityStatus,
    'available',
  );
  const stats = await get(operator, '/dashboard').expect(200);
  assert.equal(stats.body.delivered, 1);
  assert.equal(stats.body.completedFreightCents, 1000);
});
test('manual assignment requires indicated courier and decline releases reservation', async () => {
  const d = await delivery();
  await post(admin, `/deliveries/${d.id}/assign`, { version: 1, courierId: f.courier.id }).expect(
    201,
  );
  await post(second, `/deliveries/${d.id}/accept`, { version: 2 }).expect(404);
  const assigned = await get(operator, '/deliveries/' + d.id).expect(200);
  assert.equal(assigned.body.status, 'assigned');
  const privateOffer = await get(courier, '/deliveries/' + d.id).expect(200);
  assert.equal(privateOffer.body.recipientName, undefined);
  assert.equal(privateOffer.body.recipientPhone, undefined);
  assert.equal(privateOffer.body.destinationAddress, undefined);
  const declinedResponse = await post(courier, `/deliveries/${d.id}/decline`, {
    version: 2,
  }).expect(201);
  assert.equal(declinedResponse.body.recipientName, undefined);
  assert.equal(declinedResponse.body.destinationAddress, undefined);
  const released = await get(operator, '/deliveries/' + d.id).expect(200);
  assert.equal(released.body.status, 'waiting');
  assert.equal(released.body.courierId, null);
  const offers = await get(second, '/couriers/me/offers').expect(200);
  assert.ok(offers.body.items.some((o: { id: string }) => o.id === d.id));
  const declined = await get(courier, '/couriers/me/offers').expect(200);
  assert.ok(!declined.body.items.some((o: { id: string }) => o.id === d.id));
});
test('one courier cannot reserve two deliveries concurrently', async () => {
  const a = await delivery();
  const b = await delivery();
  const results = await Promise.all([
    post(admin, `/deliveries/${a.id}/assign`, { version: 1, courierId: f.courier.id }),
    post(admin, `/deliveries/${b.id}/assign`, { version: 1, courierId: f.courier.id }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const winner = results[0].status === 201 ? a : b;
  await post(courier, `/deliveries/${winner.id}/decline`, { version: 2 }).expect(201);
});
test('invalid nested DTOs and monetary configuration fail before persistence', async () => {
  await post(operator, '/pricing/quotes', {
    establishmentId: f.store.id,
    destinationAddress: [address],
    method: 'region',
    regionId: f.region.id,
  }).expect(400);
  await patch(admin, '/pricing/formula', { fee: [], payout: [] }).expect(400);
  await post(admin, '/couriers', {
    name: '   ',
    phone: '11999990000',
    vehicle: 'motorcycle',
  }).expect(400);
  await get(operator, '/dashboard?from=2026-02-31T00:00:00Z').expect(400);
  await post(operator, '/pricing/quotes', {
    establishmentId: f.store.id,
    method: 'region',
    regionId: f.region.id,
  }).expect(400);
  await post(operator, '/pricing/quotes', {
    establishmentId: f.store.id,
    destinationAddress: null,
    method: 'region',
    regionId: f.region.id,
  }).expect(400);
  await patch(admin, '/pricing/formula', {
    fee: { baseCents: -1, includedMeters: 0, perKmCents: 100, minimumCents: 0 },
    payout: { baseCents: 0, includedMeters: 0, perKmCents: 0, minimumCents: 0 },
  }).expect(400);
  await patch(operator, '/establishments/' + f.store.id, { operationOpen: null }).expect(400);
});
test('quote fingerprint, expiration and final financial snapshot are enforced', async () => {
  const input = {
    establishmentId: f.store.id,
    destinationAddress: address,
    method: 'distance',
    manualDistanceM: 4500,
    manualReason: 'Percurso conferido pelo operador',
  };
  await post(admin, '/pricing/surcharges', {
    name: 'Chuva',
    reason: 'Chuva intensa na região',
    feeFixedCents: 200,
    feePercentBps: 1000,
    payoutFixedCents: 100,
    payoutPercentBps: 2000,
    startsAt: new Date(Date.now() - 1000).toISOString(),
  }).expect(201);
  const q = await post(operator, '/pricing/quotes', input).expect(201);
  assert.equal(q.body.feeCents, 1520);
  assert.equal(q.body.payoutCents, 1210);
  const body = {
    ...input,
    quoteId: q.body.id,
    recipientName: 'Cliente',
    recipientPhone: '11999990009',
  };
  const key = randomUUID();
  const d = await post(operator, '/deliveries', body, key).expect(201);
  const repeated = await post(operator, '/deliveries', body, key).expect(201);
  assert.equal(repeated.body.id, d.body.id);
  await post(operator, '/deliveries', { ...body, recipientName: 'Outro cliente' }, key).expect(409);
  const obsolete = await post(operator, '/pricing/quotes', input).expect(201);
  await patch(admin, '/pricing/formula', {
    fee: { baseCents: 900, includedMeters: 0, perKmCents: 100, minimumCents: 900 },
    payout: { baseCents: 700, includedMeters: 0, perKmCents: 100, minimumCents: 700 },
  }).expect(200);
  await post(operator, '/deliveries', { ...body, quoteId: obsolete.body.id }).expect(409);
  const current = await get(operator, '/deliveries/' + d.body.id).expect(200);
  assert.equal(current.body.feeCents, 1520);
  assert.equal(current.body.manualDistanceM, 4500);
  const expired = await post(operator, '/pricing/quotes', input).expect(201);
  await db.quote.update({
    where: { id: expired.body.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  await post(operator, '/deliveries', { ...body, quoteId: expired.body.id }).expect(409);
});
test('pause blocks open offers and requests but preserves assigned delivery', async () => {
  const d = await delivery();
  await post(admin, `/deliveries/${d.id}/assign`, { version: 1, courierId: f.courier.id }).expect(
    201,
  );
  await patch(operator, '/establishments/' + f.store.id, { operationOpen: false }).expect(200);
  const offers = await get(second, '/couriers/me/offers').expect(200);
  assert.ok(!offers.body.items.some((o: { id: string }) => o.id === d.id));
  await post(operator, '/pricing/quotes', {
    establishmentId: f.store.id,
    destinationAddress: address,
    method: 'region',
    regionId: f.region.id,
  }).expect(400);
  await post(courier, `/deliveries/${d.id}/accept`, { version: 2 }).expect(201);
  await post(courier, `/deliveries/${d.id}/arrive`, { version: 3 }).expect(201);
  await post(courier, `/deliveries/${d.id}/collect`, { version: 4 }).expect(201);
  await post(courier, `/deliveries/${d.id}/complete`, { version: 5 }).expect(201);
  await patch(operator, '/establishments/' + f.store.id, { operationOpen: true }).expect(200);
});
test('pending courier cannot receive offers or go available', async () => {
  await db.courier.update({
    where: { id: f.second.id },
    data: { approvalStatus: 'pending', availabilityStatus: 'offline' },
  });
  await patch(second, '/couriers/me/availability', { status: 'available' }).expect(403);
  const offers = await get(second, '/couriers/me/offers').expect(200);
  assert.equal(offers.body.total, 0);
  await post(admin, `/couriers/${f.second.id}/approval-actions`, { status: 'approved' }).expect(
    201,
  );
  await patch(second, '/couriers/me/availability', { status: 'available' }).expect(200);
});
test('CRM notes persist as text with real author and no foreign access', async () => {
  const note = await post(admin, `/establishments/${f.store.id}/notes`, {
    text: '<script>alert(1)</script>',
  }).expect(201);
  assert.equal(note.body.authorName, 'admin');
  assert.equal(note.body.text, '<script>alert(1)</script>');
  await post(outsider, `/establishments/${f.store.id}/notes`, { text: 'Foreign' }).expect(404);
});
test('routing providers fall back on technical errors and reject ambiguous addresses', async () => {
  const mapbox = app.get(MapboxProvider);
  const google = app.get(GoogleProvider);
  const routing = app.get(RoutingService);
  const oldFetch = globalThis.fetch;
  const originalRouting = config.ROUTING_PROVIDER;
  config.ROUTING_PROVIDER = 'legacy';
  const originalMap = mapbox.enabled;
  const originalGoogle = google.enabled;
  mapbox.enabled = true;
  google.enabled = true;
  try {
    let googleCalls = 0;
    globalThis.fetch = async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes('mapbox')) return new Response('{}', { status: 503 });
      googleCalls++;
      return new Response(
        JSON.stringify(
          url.includes('geocode')
            ? { status: 'OK', results: [{ place_id: 'place' }] }
            : { routes: [{ distanceMeters: 3500, duration: '600s' }] },
        ),
        { status: 200 },
      );
    };
    const route = await routing.route(f.tenant.id, address, address);
    assert.equal(route.provider, 'google');
    assert.equal(route.distanceM, 3500);
    assert.ok(googleCalls > 0);
    googleCalls = 0;
    globalThis.fetch = async (input: Parameters<typeof fetch>[0]) => {
      if (String(input).includes('google')) googleCalls++;
      return new Response(JSON.stringify({ features: [] }));
    };
    await assert.rejects(routing.route(f.tenant.id, address, address), /Endereço/);
    assert.equal(googleCalls, 0);
    mapbox.enabled = false;
    google.enabled = false;
    await assert.rejects(routing.route(f.tenant.id, address, address), /Não foi possível calcular/);
  } finally {
    globalThis.fetch = oldFetch;
    config.ROUTING_PROVIDER = originalRouting;
    mapbox.enabled = originalMap;
    google.enabled = originalGoogle;
  }
});
test('password reset revokes sessions and requires initial change', async () => {
  await post(admin, '/users/' + f.secondUser.id + '/reset-password', {
    temporaryPassword: 'Another-Fixture-Password!',
  }).expect(201);
  await get(second, '/me').expect(401);
  const user = await db.user.findUniqueOrThrow({ where: { id: f.secondUser.id } });
  assert.equal(user.mustChangePassword, true);
});

test('shared Redis rate limit counts concurrent requests atomically', async () => {
  const limiter = app.get(RateLimiter);
  const results = await Promise.allSettled([
    limiter.hit('concurrent', 2),
    limiter.hit('concurrent', 2),
    limiter.hit('concurrent', 2),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 2);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
});

test('mobile login is courier-only, originless and isolated from browser cookies', async () => {
  const mobileLogin = (email: string) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/mobile/login')
      .send({ tenant: f.tenant.slug, email, password: testPassword });
  await mobileLogin('admin@example.test').expect(401);
  await mobileLogin('loja@example.test').expect(401);
  await request(app.getHttpServer())
    .post('/api/v1/auth/mobile/login')
    .set('Origin', config.APP_ORIGIN)
    .send({ tenant: f.tenant.slug, email: 'entregador@example.test', password: testPassword })
    .expect(403);
  const login = await mobileLogin('entregador@example.test').expect(201);
  assert.equal(login.headers['set-cookie'], undefined);
  assert.equal(login.body.user.role, 'courier');
  const token = login.body.accessToken;
  const session = await db.session.findUniqueOrThrow({
    where: { tokenHash: (await import('../../src/http/security.js')).digest(token) },
  });
  assert.equal(session.channel, 'mobile');
  assert.notEqual(session.tokenHash, token);
  await request(app.getHttpServer())
    .get('/api/v1/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  await request(app.getHttpServer())
    .get('/api/v1/me')
    .set('Cookie', `sd_session=${token}`)
    .expect(401);
  await request(app.getHttpServer())
    .get('/api/v1/me')
    .set('Authorization', `Bearer ${admin.cookie.split('=')[1]}`)
    .expect(401);
  await request(app.getHttpServer())
    .patch('/api/v1/couriers/me/availability')
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', config.APP_ORIGIN)
    .send({ status: 'offline' })
    .expect(403);
  await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('Authorization', `Bearer ${token}`)
    .send({})
    .expect(403);
  await request(app.getHttpServer())
    .post('/api/v1/auth/logout')
    .set('Authorization', `Bearer ${token}`)
    .expect(201);
  await request(app.getHttpServer())
    .get('/api/v1/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(401);
});

test('native courier completes a delivery with private offers, idempotency and revocation', async () => {
  const own = await fixture(db);
  try {
    const store = await login(own.tenant.slug, 'loja@example.test');
    const administrator = await login(own.tenant.slug, 'admin@example.test');
    const native = await request(app.getHttpServer())
      .post('/api/v1/auth/mobile/login')
      .send({ tenant: own.tenant.slug, email: 'entregador@example.test', password: testPassword })
      .expect(201);
    const auth = `Bearer ${native.body.accessToken}`;
    const nativeGet = (path: string) =>
      request(app.getHttpServer())
        .get('/api/v1' + path)
        .set('Authorization', auth);
    const nativePost = (path: string, body: object, key = randomUUID()) =>
      request(app.getHttpServer())
        .post('/api/v1' + path)
        .set('Authorization', auth)
        .set('Idempotency-Key', key)
        .send(body);
    const input = {
      establishmentId: own.store.id,
      destinationAddress: address,
      method: 'region',
      regionId: own.region.id,
    };
    const quote = await post(store, '/pricing/quotes', input).expect(201);
    const created = await post(store, '/deliveries', {
      ...input,
      quoteId: quote.body.id,
      recipientName: 'Cliente nativo',
      recipientPhone: '11999998888',
    }).expect(201);
    const offers = await nativeGet('/couriers/me/offers').expect(200);
    assert.equal(offers.body.items.length, 1);
    assert.equal(offers.body.items[0].recipientPhone, undefined);
    assert.equal(offers.body.items[0].destinationAddress, undefined);
    assert.equal(offers.body.items[0].feeCents, undefined);
    const otherDelivery = await db.delivery.findFirstOrThrow({ where: { tenantId: f.tenant.id } });
    await nativeGet('/deliveries/' + otherDelivery.id).expect(404);
    let version = created.body.version;
    const id = created.body.id;
    const key = randomUUID();
    const accepted = await nativePost(`/deliveries/${id}/accept`, { version }, key).expect(201);
    const replay = await nativePost(`/deliveries/${id}/accept`, { version }, key).expect(201);
    assert.equal(replay.body.version, accepted.body.version);
    version = accepted.body.version;
    for (const action of ['arrive', 'collect', 'complete']) {
      const result = await nativePost(`/deliveries/${id}/${action}`, { version }).expect(201);
      version = result.body.version;
    }
    const history = await nativeGet('/deliveries?status=delivered').expect(200);
    assert.equal(history.body.total, 1);
    assert.equal(history.body.items[0].feeCents, undefined);
    const profile = await nativeGet('/couriers/me').expect(200);
    assert.equal(profile.body.availabilityStatus, 'available');
    const dashboard = await nativeGet('/dashboard').expect(200);
    assert.equal(dashboard.body.delivered, 1);
    await post(administrator, `/users/${own.courierUser.id}/reset-password`, {
      temporaryPassword: 'Reset-Native-2026!',
    }).expect(201);
    await nativeGet('/me').expect(401);
  } finally {
    await cleanup(db, own.tenant.id);
  }
});

test('native first password gate and native login rate limit are enforced', async () => {
  const own = await fixture(db);
  try {
    await db.user.update({ where: { id: own.courierUser.id }, data: { mustChangePassword: true } });
    const signed = await request(app.getHttpServer())
      .post('/api/v1/auth/mobile/login')
      .send({ tenant: own.tenant.slug, email: 'entregador@example.test', password: testPassword })
      .expect(201);
    const auth = `Bearer ${signed.body.accessToken}`;
    await request(app.getHttpServer())
      .get('/api/v1/couriers/me')
      .set('Authorization', auth)
      .expect(403);
    await request(app.getHttpServer()).get('/api/v1/me').set('Authorization', auth).expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/password')
      .set('Authorization', auth)
      .send({ currentPassword: testPassword, newPassword: '  Native-New-Password-2026!  ' })
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/couriers/me')
      .set('Authorization', auth)
      .expect(200);
    app.get(RateLimiter).namespace = 'test-' + randomUUID();
    for (let i = 0; i < 10; i++)
      await request(app.getHttpServer())
        .post('/api/v1/auth/mobile/login')
        .send({ tenant: own.tenant.slug, email: 'missing@example.test', password: testPassword })
        .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/mobile/login')
      .send({ tenant: own.tenant.slug, email: 'missing@example.test', password: testPassword })
      .expect(429);
  } finally {
    await cleanup(db, own.tenant.id);
  }
});

test('native navigation selects the current leg, enforces courier scope and validates GPS', async () => {
  const own = await fixture(db);
  const other = await fixture(db);
  const provider = app.get(OpenRouteServiceProvider);
  const originalKey = config.OPENROUTESERVICE_API_KEY;
  const originalNavigate = provider.navigate;
  let targetStreet = '';
  try {
    config.OPENROUTESERVICE_API_KEY = 'test-key';
    provider.navigate = async (_origin, target) => {
      targetStreet = target.street;
      return {
        provider: 'openrouteservice',
        distanceM: 1000,
        durationSeconds: 120,
        coordinates: [
          { latitude: -23.55, longitude: -46.63 },
          { latitude: -23.56, longitude: -46.64 },
        ],
      };
    };
    const native = await request(app.getHttpServer())
      .post('/api/v1/auth/mobile/login')
      .send({ tenant: own.tenant.slug, email: 'entregador@example.test', password: testPassword })
      .expect(201);
    const route = (id: string, body: object) =>
      request(app.getHttpServer())
        .post(`/api/v1/deliveries/${id}/navigation`)
        .set('Authorization', `Bearer ${native.body.accessToken}`)
        .send(body);
    const make = (tenant: typeof own, courierId = tenant.courier.id) =>
      db.delivery.create({
        data: {
          tenantId: tenant.tenant.id,
          establishmentId: tenant.store.id,
          courierId,
          status: 'accepted',
          recipientName: 'Cliente',
          recipientPhone: '11999990009',
          pickupAddress: address,
          destinationAddress: { ...address, street: 'Rua do destino' },
          feeCents: 1000,
          courierPayoutCents: 800,
          pricingSnapshot: {},
        },
      });
    const delivery = await make(own);
    const foreignDelivery = await make(other);
    const secondDelivery = await make(own, own.second.id);
    const input = {
      latitude: -23.55,
      longitude: -46.63,
      timestamp: Date.now(),
      version: delivery.version,
    };
    const administrator = await login(own.tenant.slug, 'admin@example.test');
    await post(administrator, `/deliveries/${delivery.id}/navigation`, input).expect(403);
    await route(foreignDelivery.id, input).expect(404);
    await route(secondDelivery.id, input).expect(404);
    await route(delivery.id, { ...input, latitude: 91 }).expect(400);
    await route(delivery.id, { ...input, destinationAddress: address }).expect(400);
    await route(delivery.id, { ...input, timestamp: Date.now() - 31000 }).expect(400);
    const pickup = await route(delivery.id, input).expect(201);
    assert.equal(pickup.body.leg, 'pickup');
    assert.equal(targetStreet, address.street);
    assert.equal(pickup.headers['cache-control'], 'no-store');
    const collected = await db.delivery.update({
      where: { id: delivery.id },
      data: { status: 'collected', version: { increment: 1 } },
    });
    const dropoff = await route(delivery.id, { ...input, version: collected.version }).expect(201);
    assert.equal(dropoff.body.leg, 'dropoff');
    assert.equal(targetStreet, 'Rua do destino');
    await route(delivery.id, input).expect(409);
    config.OPENROUTESERVICE_API_KEY = '';
    const unavailable = await route(delivery.id, { ...input, version: collected.version }).expect(
      503,
    );
    assert.equal(unavailable.body.code, 'NAVIGATION_NOT_CONFIGURED');
    await db.delivery.update({ where: { id: delivery.id }, data: { status: 'delivered' } });
    await route(delivery.id, { ...input, version: collected.version }).expect(409);
  } finally {
    config.OPENROUTESERVICE_API_KEY = originalKey;
    provider.navigate = originalNavigate;
    await cleanup(db, own.tenant.id);
    await cleanup(db, other.tenant.id);
  }
});
