import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApplication } from '../../src/app.js';
import { Database } from '../../src/database.js';
import { RateLimiter } from '../../src/http/security.js';
import { config } from '../../src/config.js';
import { fixture, cleanup, testPassword, address } from '../fixtures.js';
let app: INestApplication, db: Database, f: Awaited<ReturnType<typeof fixture>>, other: typeof f;
type Session = { cookie: string; csrf: string };
let admin: Session, shop: Session, courier: Session, outsider: Session;
const reason = 'Teste do fechamento e repasse simulado';
async function login(slug: string, email: string) {
  const r = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('Origin', config.APP_ORIGIN)
    .send({ tenant: slug, email, password: testPassword })
    .expect(201);
  return { cookie: r.headers['set-cookie'][0].split(';')[0], csrf: r.body.csrfToken };
}
const post = (s: Session, path: string, body: object = {}, key = randomUUID()) =>
  request(app.getHttpServer())
    .post('/api/v1/finance' + path)
    .set('Origin', config.APP_ORIGIN)
    .set('Cookie', s.cookie)
    .set('X-CSRF-Token', s.csrf)
    .set('Idempotency-Key', key)
    .send(body);
const get = (s: Session, path: string) =>
  request(app.getHttpServer())
    .get('/api/v1/finance' + path)
    .set('Cookie', s.cookie);
let versionId: string, allocationId: string, earningId: string;
before(async () => {
  app = (await createApplication()).app;
  await app.init();
  app.get(RateLimiter).namespace = 'test-settlement-' + randomUUID();
  db = app.get(Database);
  f = await fixture(db);
  other = await fixture(db);
  admin = await login(f.tenant.slug, f.admin.email);
  shop = await login(f.tenant.slug, f.operator.email);
  courier = await login(f.tenant.slug, f.courierUser.email);
  outsider = await login(other.tenant.slug, other.admin.email);
  await post(admin, '/enable', { reason }).expect(201);
  await post(admin, `/wallets/${f.store.id}`, { enabled: true, reason }).expect(201);
  await post(admin, '/topups', {
    establishmentId: f.store.id,
    amountCents: '80000',
    scenario: 'approve',
    reference: randomUUID(),
    reason,
  }).expect(201);
  await post(admin, '/process').expect(201);
  const c = await db.merchantContract.create({
    data: { tenantId: f.tenant.id, establishmentId: f.store.id, title: 'Fechamento' },
  });
  const v = await db.contractVersion.create({
    data: {
      tenantId: f.tenant.id,
      contractId: c.id,
      number: 1,
      status: 'accepted',
      effectiveFrom: new Date('2026-09-01T03:00:00Z'),
      effectiveTo: new Date('2026-10-01T03:00:00Z'),
      terms: {
        timezone: 'America/Sao_Paulo',
        coverage: 'Franca',
        servicePolicy: 'Proporcional',
        weeklyAvailabilityCents: 80000,
        platformFeeCents: 0,
        deliveryFeeCents: 200,
        payModel: 'guarantee',
        courierFixedCents: 10000,
        courierDeliveryCents: 1000,
        templates: [
          { weekday: 1, startMinute: 600, endMinute: 700, courierCount: 1, expectedDeliveries: 5 },
        ],
      },
    },
  });
  versionId = v.id;
  const s = await db.scheduledShift.create({
    data: {
      tenantId: f.tenant.id,
      versionId,
      templateIndex: 0,
      capacity: 1,
      startsAt: new Date('2026-09-07T13:00:00Z'),
      endsAt: new Date('2026-09-07T14:40:00Z'),
    },
  });
  const a = await db.courierAllocation.create({
    data: {
      tenantId: f.tenant.id,
      shiftId: s.id,
      courierId: f.courier.id,
      position: 1,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
    },
  });
  allocationId = a.id;
  await post(admin, '/reservations/week', { versionId, week: '2026-09-07' }).expect(201);
});
after(async () => {
  if (f) await cleanup(db, f.tenant.id);
  if (other) await cleanup(db, other.tenant.id);
  await app?.close();
});
test('settlement requires presence, scopes roles and closes 800/720/80 once under concurrency', async () => {
  const input = { versionId, week: '2026-09-07' };
  await post(shop, '/settlements', input).expect(403);
  await post(courier, '/settlements', input).expect(403);
  await post(admin, '/settlements', input).expect(409);
  await db.attendanceEvent.create({
    data: {
      tenantId: f.tenant.id,
      allocationId,
      actorUserId: f.admin.id,
      attendedMinutes: 90,
      reason,
    },
  });
  const results = await Promise.all([
    post(admin, '/settlements', input).expect(201),
    post(admin, '/settlements', input).expect(201),
  ]);
  assert.equal(results[0].body.id, results[1].body.id);
  assert.equal(results[0].body.total, '72000');
  const balance = (await get(shop, '/wallet').expect(200)).body;
  assert.equal(balance.availableCents, '8000');
  assert.equal(balance.reservedCents, '0');
  const merchant = (await get(shop, '/settlements').expect(200)).body.items[0];
  assert.equal(merchant.releasedCents, '8000');
  assert.ok(!JSON.stringify(merchant).includes('courierFixed'));
  await get(shop, `/settlements?establishmentId=${f.otherStore.id}`).expect(403);
  assert.equal(
    (await get(outsider, `/settlements?establishmentId=${f.store.id}`).expect(200)).body.items
      .length,
    0,
  );
  const earnings = (await get(courier, '/earnings').expect(200)).body.items;
  assert.equal(earnings.length, 1);
  assert.equal(earnings[0].amountCents, '9000');
  earningId = earnings[0].id;
  await get(shop, '/earnings').expect(403);
  await get(courier, `/earnings?courierId=${f.second.id}`).expect(403);
  assert.equal((await get(outsider, '/earnings').expect(200)).body.items.length, 0);
});
test('closed documents and attendance cannot be rewritten and late reservations are refused', async () => {
  const doc = await db.financeSettlement.findFirstOrThrow({ where: { tenantId: f.tenant.id } });
  await assert.rejects(db.financeSettlement.update({ where: { id: doc.id }, data: { total: 1n } }));
  await assert.rejects(
    db.financeEarning.update({ where: { id: earningId }, data: { amount: 1n } }),
  );
  await assert.rejects(
    db.attendanceEvent.create({
      data: {
        tenantId: f.tenant.id,
        allocationId,
        actorUserId: f.admin.id,
        attendedMinutes: 100,
        reason,
      },
    }),
  );
  const d = await db.delivery.create({
    data: {
      tenantId: f.tenant.id,
      establishmentId: f.store.id,
      pickupAddress: address,
      destinationAddress: address,
      recipientName: 'Teste',
      recipientPhone: '16999999999',
      feeCents: 700,
      courierPayoutCents: 500,
      pricingSnapshot: {},
      createdAt: new Date('2026-09-07T13:30:00Z'),
    },
  });
  await post(admin, '/reservations/delivery', { deliveryId: d.id }).expect(409);
});
test('payout uncertainty keeps obligation, repeated confirmation pays once and return restores it once', async () => {
  await post(shop, '/payouts', { earningId, scenario: 'approve', reason }).expect(403);
  const r = await post(admin, '/payouts', {
    earningId,
    scenario: 'timeout_after_accept',
    reason,
  }).expect(201);
  await post(admin, '/payouts', { earningId, scenario: 'approve', reason }).expect(409);
  const repeated = await post(admin, '/payouts', {
    earningId,
    scenario: 'timeout_after_accept',
    reason,
  }).expect(201);
  assert.equal(r.body.id, repeated.body.id);
  await post(admin, `/payouts/${r.body.id}/process`, { reason })
    .expect(201)
    .then((r) => assert.equal(r.body.status, 'unknown'));
  await post(admin, `/payouts/${r.body.id}/return`, { reason }).expect(409);
  await Promise.all([
    post(admin, `/payouts/${r.body.id}/process`, { reason }).expect(201),
    post(admin, `/payouts/${r.body.id}/process`, { reason }).expect(201),
  ]);
  assert.equal(
    await db.ledgerTransaction.count({
      where: { tenantId: f.tenant.id, source: `payout:${r.body.id}` },
    }),
    1,
  );
  await post(admin, `/payouts/${r.body.id}/return`, { reason }).expect(201);
  await post(admin, `/payouts/${r.body.id}/return`, { reason }).expect(201);
  assert.equal(
    await db.ledgerTransaction.count({
      where: { tenantId: f.tenant.id, source: `payout-return:${r.body.id}` },
    }),
    1,
  );
  const decline = await post(admin, '/payouts', { earningId, scenario: 'decline', reason }).expect(
    201,
  );
  await post(admin, `/payouts/${decline.body.id}/process`, { reason })
    .expect(201)
    .then((r) => assert.equal(r.body.status, 'rejected'));
  const next = await post(admin, '/payouts', { earningId, scenario: 'approve', reason }).expect(
    201,
  );
  assert.notEqual(next.body.id, decline.body.id);
});
test('completed reserved deliveries charge only contract variable and guarantee includes those earnings', async () => {
  await post(admin, '/topups', {
    establishmentId: f.store.id,
    amountCents: '81000',
    scenario: 'approve',
    reference: randomUUID(),
    reason,
  }).expect(201);
  await post(admin, '/process').expect(201);
  const s = await db.scheduledShift.create({
    data: {
      tenantId: f.tenant.id,
      versionId,
      templateIndex: 0,
      capacity: 1,
      startsAt: new Date('2026-09-14T13:00:00Z'),
      endsAt: new Date('2026-09-14T14:40:00Z'),
    },
  });
  const a = await db.courierAllocation.create({
    data: {
      tenantId: f.tenant.id,
      shiftId: s.id,
      courierId: f.courier.id,
      position: 1,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
    },
  });
  await db.attendanceEvent.create({
    data: {
      tenantId: f.tenant.id,
      allocationId: a.id,
      actorUserId: f.admin.id,
      attendedMinutes: 100,
      reason,
    },
  });
  await post(admin, '/reservations/week', { versionId, week: '2026-09-14' }).expect(201);
  const d = await db.delivery.create({
    data: {
      tenantId: f.tenant.id,
      establishmentId: f.store.id,
      pickupAddress: address,
      destinationAddress: address,
      recipientName: 'Teste',
      recipientPhone: '16999999999',
      feeCents: 7000,
      courierPayoutCents: 5000,
      pricingSnapshot: {},
      createdAt: new Date('2026-09-14T13:30:00Z'),
    },
  });
  const reserve = await post(admin, '/reservations/delivery', { deliveryId: d.id }).expect(201);
  assert.equal(reserve.body.amount, '200');
  await post(admin, '/settlements', { versionId, week: '2026-09-14' }).expect(409);
  await db.delivery.update({
    where: { id: d.id },
    data: { status: 'delivered', courierId: f.courier.id },
  });
  const result = await post(admin, '/settlements', { versionId, week: '2026-09-14' }).expect(201);
  assert.equal(result.body.total, '80200');
  const e = await db.financeEarning.findFirstOrThrow({
    where: { tenantId: f.tenant.id, settlementId: result.body.id },
  });
  assert.equal(e.amount, 10000n);
  assert.equal((e.snapshot as { supplement: string }).supplement, '9000');
  assert.equal(
    (await db.financeReservation.findUniqueOrThrow({ where: { id: reserve.body.id } })).consumed,
    200n,
  );
});
test('merchant unconsumed credit cannot fund a payout and missing shifts never count as absence', async () => {
  const c = await db.merchantContract.create({
    data: {
      tenantId: f.tenant.id,
      establishmentId: f.otherStore.id,
      title: 'Custo maior que receita',
    },
  });
  const v = await db.contractVersion.create({
    data: {
      tenantId: f.tenant.id,
      contractId: c.id,
      number: 1,
      status: 'accepted',
      effectiveFrom: new Date('2026-09-01T03:00:00Z'),
      effectiveTo: new Date('2026-10-01T03:00:00Z'),
      terms: {
        timezone: 'America/Sao_Paulo',
        coverage: 'Franca',
        servicePolicy: 'Proporcional',
        weeklyAvailabilityCents: 100,
        platformFeeCents: 0,
        deliveryFeeCents: 0,
        payModel: 'fixed',
        courierFixedCents: 99999999,
        courierDeliveryCents: 0,
        templates: [
          { weekday: 1, startMinute: 600, endMinute: 700, courierCount: 1, expectedDeliveries: 0 },
        ],
      },
    },
  });
  await post(admin, `/wallets/${f.otherStore.id}`, { enabled: true, reason }).expect(201);
  await post(admin, '/topups', {
    establishmentId: f.otherStore.id,
    amountCents: '100000000',
    scenario: 'approve',
    reference: randomUUID(),
    reason,
  }).expect(201);
  await post(admin, '/process').expect(201);
  await post(admin, '/reservations/week', { versionId: v.id, week: '2026-09-21' }).expect(201);
  await post(admin, '/settlements', { versionId: v.id, week: '2026-09-21' }).expect(409);
  const s = await db.scheduledShift.create({
    data: {
      tenantId: f.tenant.id,
      versionId: v.id,
      templateIndex: 0,
      capacity: 1,
      startsAt: new Date('2026-09-21T13:00:00Z'),
      endsAt: new Date('2026-09-21T14:40:00Z'),
    },
  });
  const a = await db.courierAllocation.create({
    data: {
      tenantId: f.tenant.id,
      shiftId: s.id,
      courierId: f.courier.id,
      position: 1,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
    },
  });
  await db.attendanceEvent.create({
    data: {
      tenantId: f.tenant.id,
      allocationId: a.id,
      actorUserId: f.admin.id,
      attendedMinutes: 100,
      reason,
    },
  });
  const result = await post(admin, '/settlements', { versionId: v.id, week: '2026-09-21' }).expect(
    201,
  );
  const earning = await db.financeEarning.findFirstOrThrow({
    where: { settlementId: result.body.id },
  });
  await post(admin, '/payouts', { earningId: earning.id, scenario: 'approve', reason }).expect(409);
  assert.equal(earning.amount, 99999999n); // Ganho legítimo independe do caixa disponível.
});

test('treasury distinguishes merchant credit, cash and earnings and reconciles postings', async () => {
  await get(shop, '/treasury').expect(403);
  await get(courier, '/treasury').expect(403);
  const view = (await get(admin, '/treasury').expect(200)).body;
  assert.equal(view.accountingConsistent, true);
  assert.ok(BigInt(view.merchantCreditCents) > 99900000n);
  assert.ok(BigInt(view.freeCashCents) < BigInt(view.dueCents));
});

test('database preserves payout origin and terminal state', async () => {
  const payout = await db.financePayout.findFirstOrThrow({
    where: { tenantId: f.tenant.id, status: 'returned' },
  });
  await assert.rejects(db.financePayout.update({ where: { id: payout.id }, data: { amount: 1n } }));
  await assert.rejects(
    db.financePayout.update({ where: { id: payout.id }, data: { status: 'pending' } }),
  );
  await assert.rejects(db.financePayout.delete({ where: { id: payout.id } }));
  const attendance = await db.attendanceEvent.findFirstOrThrow({
    where: { tenantId: f.tenant.id, allocationId },
  });
  await assert.rejects(
    db.attendanceEvent.update({ where: { id: attendance.id }, data: { attendedMinutes: 1 } }),
  );
});
test('zero merchant tariff still records delivery participation and pays contractual courier variable', async () => {
  const c = await db.merchantContract.create({
    data: {
      tenantId: f.tenant.id,
      establishmentId: f.store.id,
      title: 'Entrega sem tarifa variável da loja',
    },
  });
  const v = await db.contractVersion.create({
    data: {
      tenantId: f.tenant.id,
      contractId: c.id,
      number: 1,
      status: 'accepted',
      effectiveFrom: new Date('2026-08-01T03:00:00Z'),
      effectiveTo: new Date('2026-09-01T03:00:00Z'),
      terms: {
        timezone: 'America/Sao_Paulo',
        coverage: 'Franca',
        servicePolicy: 'Proporcional',
        weeklyAvailabilityCents: 0,
        platformFeeCents: 0,
        deliveryFeeCents: 0,
        payModel: 'per_delivery',
        courierFixedCents: 0,
        courierDeliveryCents: 1000,
        templates: [
          { weekday: 1, startMinute: 600, endMinute: 700, courierCount: 1, expectedDeliveries: 5 },
        ],
      },
    },
  });
  const s = await db.scheduledShift.create({
    data: {
      tenantId: f.tenant.id,
      versionId: v.id,
      templateIndex: 0,
      capacity: 1,
      startsAt: new Date('2026-08-03T13:00:00Z'),
      endsAt: new Date('2026-08-03T14:40:00Z'),
    },
  });
  const a = await db.courierAllocation.create({
    data: {
      tenantId: f.tenant.id,
      shiftId: s.id,
      courierId: f.courier.id,
      position: 1,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
    },
  });
  await db.attendanceEvent.create({
    data: {
      tenantId: f.tenant.id,
      allocationId: a.id,
      actorUserId: f.admin.id,
      attendedMinutes: 100,
      reason,
    },
  });
  const d = await db.delivery.create({
    data: {
      tenantId: f.tenant.id,
      establishmentId: f.store.id,
      pickupAddress: address,
      destinationAddress: address,
      recipientName: 'Teste',
      recipientPhone: '16999999999',
      feeCents: 7000,
      courierPayoutCents: 5000,
      pricingSnapshot: {},
      createdAt: new Date('2026-08-03T13:30:00Z'),
    },
  });
  const reserved = await post(admin, '/reservations/delivery', { deliveryId: d.id }).expect(201);
  assert.equal(reserved.body.amount, '0');
  assert.equal(
    await db.ledgerTransaction.count({
      where: { tenantId: f.tenant.id, source: `reserve:${reserved.body.id}` },
    }),
    0,
  );
  await db.delivery.update({
    where: { id: d.id },
    data: { status: 'delivered', courierId: f.courier.id },
  });
  const result = await post(admin, '/settlements', { versionId: v.id, week: '2026-08-03' }).expect(
    201,
  );
  assert.equal(result.body.total, '0');
  const earning = await db.financeEarning.findFirstOrThrow({
    where: { settlementId: result.body.id },
  });
  assert.equal(earning.amount, 1000n);
});
