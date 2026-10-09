import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApplication } from '../../src/app.js';
import { Database } from '../../src/database.js';
import { RateLimiter } from '../../src/http/security.js';
import { config } from '../../src/config.js';
import { fixture, cleanup, address, testPassword } from '../fixtures.js';
let app: INestApplication, db: Database, f: Awaited<ReturnType<typeof fixture>>, other: typeof f;
type Session = { cookie: string; csrf: string };
let admin: Session, shop: Session, courier: Session, outsider: Session;
const post = (s: Session, path: string, body: object, key = randomUUID()) =>
  request(app.getHttpServer())
    .post('/api/v1' + path)
    .set('Cookie', s.cookie)
    .set('Origin', config.APP_ORIGIN)
    .set('X-CSRF-Token', s.csrf)
    .set('Idempotency-Key', key)
    .send(body);
const get = (s: Session) =>
  request(app.getHttpServer()).get('/api/v1/external-orders').set('Cookie', s.cookie);
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
  app.get(RateLimiter).namespace = `test-external-${randomUUID()}`;
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
test('simulated ingestion is scoped, rejects live mode and deduplicates concurrent retries', async () => {
  const input = { establishmentId: f.store.id, provider: 'ifood', externalReference: 'DEMO-001' };
  await post(courier, '/external-orders/simulate', input).expect(403);
  await post(shop, '/external-orders/simulate', {
    ...input,
    establishmentId: f.otherStore.id,
  }).expect(403);
  await post(outsider, '/external-orders/simulate', input).expect(404);
  await post(shop, '/external-orders/simulate', { ...input, mode: 'live' }).expect(400);
  const responses = await Promise.all([
    post(shop, '/external-orders/simulate', input),
    post(shop, '/external-orders/simulate', input),
  ]);
  responses.forEach((r) => assert.equal(r.status, 201));
  assert.equal(responses[0].body.id, responses[1].body.id);
  assert.equal(responses[0].body.mode, 'demo');
  await post(admin, '/external-orders/simulate', {
    ...input,
    establishmentId: f.otherStore.id,
  }).expect(201);
  await post(shop, '/external-orders/simulate', { ...input, provider: '99food' }).expect(201);
  assert.equal((await get(admin).expect(200)).body.total, 3);
  assert.equal((await get(shop).expect(200)).body.total, 2);
  assert.equal((await get(outsider).expect(200)).body.total, 0);
  await get(courier).expect(403);
});
test('conversion is atomic, consumes one quote and never creates two deliveries for an order', async () => {
  const input = {
    establishmentId: f.store.id,
    destinationAddress: address,
    method: 'region',
    regionId: f.region.id,
  };
  const order = await post(shop, '/external-orders/simulate', {
    establishmentId: f.store.id,
    provider: 'ifood',
    externalReference: 'DEMO-CONVERT',
  }).expect(201);
  const quotes = await Promise.all([
    post(shop, '/pricing/quotes', input),
    post(shop, '/pricing/quotes', input),
  ]);
  const results = await Promise.all(
    quotes.map((q) =>
      post(shop, '/deliveries', {
        ...input,
        quoteId: q.body.id,
        recipientName: order.body.recipientName,
        recipientPhone: order.body.recipientPhone,
        externalOrderId: order.body.id,
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    await db.delivery.count({
      where: { tenantId: f.tenant.id, externalOrders: { some: { id: order.body.id } } },
    }),
    1,
  );
  assert.equal(
    await db.quote.count({ where: { id: { in: quotes.map((q) => q.body.id) }, consumed: true } }),
    1,
  );
  const listed = (await get(shop).expect(200)).body.items.find(
    (o: { id: string }) => o.id === order.body.id,
  );
  assert.equal(listed.delivery.status, 'waiting');
  const foreignInput = { ...input, establishmentId: other.store.id };
  const foreignQuote = await post(outsider, '/pricing/quotes', {
    ...foreignInput,
    regionId: other.region.id,
  }).expect(201);
  await post(outsider, '/deliveries', {
    ...foreignInput,
    regionId: other.region.id,
    quoteId: foreignQuote.body.id,
    recipientName: 'Cliente',
    recipientPhone: '16000000000',
    externalOrderId: order.body.id,
  }).expect(404);
});
