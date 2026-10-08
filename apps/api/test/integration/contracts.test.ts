import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApplication } from '../../src/app.js';
import { Database } from '../../src/database.js';
import { fixture, cleanup, testPassword } from '../fixtures.js';
import { config } from '../../src/config.js';
import type { INestApplication } from '@nestjs/common';
let app: INestApplication, db: Database, f: Awaited<ReturnType<typeof fixture>>, other: typeof f;
type Session = { cookie: string; csrf: string };
let admin: Session, shop: Session, outsider: Session;
const terms = {
  timezone: 'America/Sao_Paulo',
  coverage: 'Franca–SP',
  servicePolicy: 'Disponibilidade e substituição registradas pelo gestor.',
  weeklyAvailabilityCents: 60000,
  platformFeeCents: 0,
  deliveryFeeCents: 200,
  payModel: 'fixed',
  courierFixedCents: 5000,
  courierDeliveryCents: 0,
  templates: [
    { weekday: 1, startMinute: 1080, endMinute: 1380, courierCount: 2, expectedDeliveries: 100 },
  ],
};
const start = new Date('2030-01-07T21:00:00Z');
const post = (s: Session, path: string, body: object, key = randomUUID()) =>
  request(app.getHttpServer())
    .post('/api/v1' + path)
    .set('Origin', config.APP_ORIGIN)
    .set('Cookie', s.cookie)
    .set('X-CSRF-Token', s.csrf)
    .set('Idempotency-Key', key)
    .send(body);
const get = (s: Session, path: string) =>
  request(app.getHttpServer())
    .get('/api/v1' + path)
    .set('Cookie', s.cookie);
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
  db = app.get(Database);
  f = await fixture(db);
  other = await fixture(db);
  admin = await login(f.tenant.slug, 'admin@example.test');
  shop = await login(f.tenant.slug, 'loja@example.test');
  outsider = await login(other.tenant.slug, 'admin@example.test');
});
after(async () => {
  if (f) await cleanup(db, f.tenant.id);
  if (other) await cleanup(db, other.tenant.id);
  await app?.close();
});
async function accepted() {
  const b = {
    title: 'Contrato semanal',
    establishmentId: f.store.id,
    effectiveFrom: '2030-01-01T03:00:00Z',
    effectiveTo: '2030-02-01T03:00:00Z',
    terms,
  };
  const r = await post(admin, '/contracts', b).expect(201);
  await post(admin, `/contract-versions/${r.body.version.id}/propose`, { revision: 1 }).expect(201);
  await post(shop, `/contract-versions/${r.body.version.id}/accept`, {
    revision: 2,
    evidence: 'Concordo com as condições da proposta.',
  }).expect(201);
  return r.body;
}
test('contract lifecycle, immutable proposals, scoped financial data and capacity concurrency', async (t) => {
  const c = await accepted();
  const id = c.version.id;
  const list = (await get(shop, '/contracts').expect(200)).body.items;
  assert.equal(list[0].versions[0].terms.courierFixedCents, undefined);
  assert.equal(list[0].versions[0].budget.estimatedCourierCents, undefined);
  assert.equal(list[0].versions[0].budget.merchantCents, 80000);
  assert.equal((await get(outsider, '/contracts').expect(200)).body.total, 0);
  await post(outsider, `/contract-versions/${id}/accept`, {
    revision: 2,
    evidence: 'Não deve aceitar outra empresa.',
  }).expect(404);
  await post(shop, '/contract-shifts', {
    versionId: id,
    templateIndex: 0,
    startsAt: start.toISOString(),
  }).expect(403);
  await assert.rejects(
    db.contractVersion.update({
      where: { id },
      data: { terms: { ...terms, weeklyAvailabilityCents: 1 } },
    }),
  );
  const scheduleKey = randomUUID(),
    body = { versionId: id, templateIndex: 0, startsAt: start.toISOString() };
  const s = (await post(admin, '/contract-shifts', body, scheduleKey).expect(201)).body;
  assert.equal(
    (await post(admin, '/contract-shifts', body, scheduleKey).expect(201)).body.id,
    s.id,
  );
  const a = { courierId: f.courier.id, position: 1, startsAt: s.startsAt, endsAt: s.endsAt };
  const results = await Promise.all([
    post(admin, `/contract-shifts/${s.id}/allocate`, a),
    post(admin, `/contract-shifts/${s.id}/allocate`, { ...a, position: 2 }),
  ]);
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 1);
  const allocation = results.find((r) => r.status === 201)!.body;
  await post(admin, `/contract-shifts/${s.id}/allocate`, {
    ...a,
    courierId: other.courier.id,
    position: 2,
  }).expect(404);
  await post(admin, `/contract-shifts/${s.id}/allocate`, {
    ...a,
    courierId: f.second.id,
    position: 3,
  }).expect(400);
  await post(admin, `/contract-allocations/${allocation.id}/attendance`, {
    attendedMinutes: 100,
    reason: 'Presença ainda no futuro.',
  }).expect(400);
  await post(admin, `/contract-allocations/${allocation.id}/cancel`, {
    reason: 'Substituição combinada com o estabelecimento.',
  }).expect(201);
  const half = new Date(start.getTime() + 2 * 3600000).toISOString();
  await post(admin, `/contract-shifts/${s.id}/allocate`, { ...a, endsAt: half }).expect(201);
  await post(admin, `/contract-shifts/${s.id}/allocate`, {
    ...a,
    courierId: f.second.id,
    startsAt: half,
  }).expect(201);
  assert.equal((await get(shop, '/contract-shifts').expect(200)).body.total, 1);
  await post(admin, `/contract-shifts/${s.id}/cancel`, {
    reason: 'Cancelamento combinado antes do início.',
  }).expect(201);
  assert.equal(
    await db.courierAllocation.count({ where: { shiftId: s.id, cancelledAt: null } }),
    0,
  );
  const v = (
    await post(admin, `/contracts/${c.id}/versions`, {
      effectiveFrom: '2030-02-01T03:00:00Z',
      effectiveTo: '2030-03-01T03:00:00Z',
      terms: { ...terms, weeklyAvailabilityCents: 70000 },
    }).expect(201)
  ).body;
  assert.equal(v.number, 2);
  const shift2 = (
    await post(admin, '/contract-shifts', {
      versionId: id,
      templateIndex: 0,
      startsAt: '2030-01-14T21:00:00Z',
    }).expect(201)
  ).body;
  let assignment = (
    await post(admin, `/contract-shifts/${shift2.id}/allocate`, {
      courierId: f.courier.id,
      position: 1,
      startsAt: shift2.startsAt,
      endsAt: shift2.endsAt,
    }).expect(201)
  ).body;
  await db.session.updateMany({
    where: { tenantId: f.tenant.id },
    data: { expiresAt: new Date('2100-01-01T00:00:00Z') },
  });
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2030-01-14T21:00:00Z') });
  try {
    const firstId = assignment.id;
    assignment = (
      await post(admin, `/contract-allocations/${assignment.id}/replace`, {
        courierId: f.second.id,
        reason: 'Substituição exatamente no início do turno.',
      }).expect(201)
    ).body;
    assert.ok(
      (await db.courierAllocation.findUniqueOrThrow({ where: { id: firstId } })).cancelledAt,
    );
    t.mock.timers.setTime(new Date('2030-01-14T23:00:00Z').getTime());
    const replaced = (
      await post(admin, `/contract-allocations/${assignment.id}/replace`, {
        courierId: f.courier.id,
        reason: 'Substituição durante o turno por indisponibilidade.',
      }).expect(201)
    ).body;
    const original = await db.courierAllocation.findUniqueOrThrow({ where: { id: assignment.id } });
    assert.equal(original.endsAt.toISOString(), replaced.startsAt);
    assert.equal(replaced.endsAt, shift2.endsAt);
    await post(admin, `/contract-allocations/${assignment.id}/attendance`, {
      attendedMinutes: 121,
      reason: 'Não pode registrar acima do intervalo.',
    }).expect(400);
    await post(admin, `/contract-allocations/${assignment.id}/attendance`, {
      attendedMinutes: 120,
      reason: 'Presença conferida pelo gestor responsável.',
    }).expect(201);
    await post(admin, `/contract-allocations/${assignment.id}/attendance`, {
      attendedMinutes: 110,
      reason: 'Ajuste de dez minutos após revisão da presença.',
    }).expect(201);
    assert.equal(await db.attendanceEvent.count({ where: { allocationId: assignment.id } }), 2);
  } finally {
    t.mock.timers.reset();
  }

  assert.equal(
    (await db.contractVersion.findUniqueOrThrow({ where: { id } })).terms &&
      (await get(shop, '/contracts')).body.items[0].versions.length,
    1,
  );
});
