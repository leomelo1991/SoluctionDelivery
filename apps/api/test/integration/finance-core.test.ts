import { RateLimiter } from '../../src/http/security.js';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApplication } from '../../src/app.js';
import { Database } from '../../src/database.js';
import { config } from '../../src/config.js';
import { fixture, cleanup, address, testPassword } from '../fixtures.js';
import { FinanceWorker, applySandboxEvent } from '../../src/modules/finance/worker.js';
import {
  account,
  balance,
  financeLock,
  post as ledgerPost,
} from '../../src/modules/finance/ledger.js';
import { atomic } from '../../src/modules/transactions.js';
let app: INestApplication, db: Database, f: Awaited<ReturnType<typeof fixture>>, other: typeof f;
type Session = { cookie: string; csrf: string };
let admin: Session, second: Session, shop: Session, outsider: Session, courier: Session;
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
    .set('Cookie', s.cookie)
    .set('Origin', config.APP_ORIGIN)
    .set('X-CSRF-Token', s.csrf)
    .set('Idempotency-Key', key)
    .send(body);
const get = (s: Session, path: string) =>
  request(app.getHttpServer())
    .get('/api/v1/finance' + path)
    .set('Cookie', s.cookie);
const reason = 'Cenário financeiro de integração';
let secondId: string;
before(async () => {
  app = (await createApplication()).app;
  await app.init();
  app.get(RateLimiter).namespace = 'test-finance-core-' + randomUUID();
  db = app.get(Database);
  f = await fixture(db);
  other = await fixture(db);
  const user = await db.user.create({
    data: {
      tenantId: f.tenant.id,
      email: 'finance@example.test',
      name: 'Gestor dois',
      role: 'admin',
      passwordHash: f.admin.passwordHash,
      mustChangePassword: false,
    },
  });
  secondId = user.id;
  admin = await login(f.tenant.slug, f.admin.email);
  second = await login(f.tenant.slug, user.email);
  shop = await login(f.tenant.slug, f.operator.email);
  courier = await login(f.tenant.slug, f.courierUser.email);
  outsider = await login(other.tenant.slug, other.admin.email);
});
after(async () => {
  if (f) await cleanup(db, f.tenant.id);
  if (other) await cleanup(db, other.tenant.id);
  await app?.close();
});
async function topup(value: string, scenario = 'approve', reference = randomUUID()) {
  const r = await post(admin, '/topups', {
    establishmentId: f.store.id,
    amountCents: value,
    scenario,
    reference,
    reason,
  }).expect(201);
  return r.body as { id: string };
}
async function forceDue() {
  await db.financeTask.updateMany({
    where: { tenantId: f.tenant.id, status: 'pending' },
    data: { nextAttemptAt: new Date(0) },
  });
}
async function delivery(feeCents = 70000) {
  return db.delivery.create({
    data: {
      tenantId: f.tenant.id,
      establishmentId: f.store.id,
      pickupAddress: address,
      destinationAddress: address,
      recipientName: 'Teste',
      recipientPhone: '11999999999',
      feeCents,
      courierPayoutCents: 500,
      pricingSnapshot: {},
    },
  });
}
test('explicit activation, financial capability and store/tenant isolation', async () => {
  assert.equal((await get(admin, '/status')).body.enabled, false);
  await post(shop, '/enable', { reason }).expect(403);
  await post(courier, '/enable', { reason }).expect(403);
  await post(admin, '/enable', { reason }).expect(201);
  await post(second, `/wallets/${f.store.id}`, { enabled: true, reason }).expect(403);
  await post(second, '/enable', { reason }).expect(409);
  await post(admin, `/wallets/${f.store.id}`, { enabled: true, reason }).expect(201);
  await post(admin, `/wallets/${other.store.id}`, { enabled: true, reason }).expect(404);
  await get(shop, `/wallet?establishmentId=${f.otherStore.id}`).expect(403);
  await get(outsider, `/wallet?establishmentId=${f.store.id}`).expect(404);
  await post(admin, '/permissions', { userId: secondId, enabled: true, reason }).expect(201);
  assert.equal((await get(second, '/status')).body.canManage, true);
  await post(shop, '/process').expect(403);
});
test('unknown provider result is recovered, replay between users/events never credits twice', async () => {
  const reference = randomUUID();
  const body = {
    establishmentId: f.store.id,
    amountCents: '80000',
    scenario: 'timeout_after_accept',
    reference,
    reason,
  };
  const r = await post(admin, '/topups', body).expect(201);
  const repeated = await post(second, '/topups', body).expect(201);
  assert.equal(repeated.body.id, r.body.id);
  await post(second, '/topups', { ...body, amountCents: '80001' }).expect(409);
  assert.equal((await get(shop, '/wallet')).body.availableCents, '0');
  await post(admin, '/process').expect(201);
  assert.equal(
    (await db.financeTopup.findUniqueOrThrow({ where: { id: r.body.id } })).status,
    'unknown',
  );
  assert.equal((await get(shop, '/wallet')).body.availableCents, '0');
  await forceDue();
  await Promise.all([
    app.get(FinanceWorker).run(f.tenant.id),
    app.get(FinanceWorker).run(f.tenant.id),
  ]);
  assert.equal((await get(shop, '/wallet')).body.availableCents, '80000');
  for (let i = 0; i < 10; i++)
    await atomic(db, async (tx) => {
      await financeLock(tx, f.tenant.id);
      await applySandboxEvent(tx, f.tenant.id, r.body.id, {
        eventId: `fake:${r.body.id}:confirmed`,
        outcome: 'confirmed',
      });
    });
  await atomic(db, async (tx) => {
    await financeLock(tx, f.tenant.id);
    await applySandboxEvent(tx, f.tenant.id, r.body.id, {
      eventId: `fake:${r.body.id}:late_rejected`,
      outcome: 'rejected',
    });
  });
  assert.equal((await get(shop, '/wallet')).body.availableCents, '80000');
  assert.equal(
    await db.ledgerTransaction.count({
      where: { tenantId: f.tenant.id, source: `fund:${r.body.id}` },
    }),
    1,
  );
  const decline = await topup('10000', 'decline');
  await post(admin, '/process').expect(201);
  assert.equal(
    (await db.financeTopup.findUniqueOrThrow({ where: { id: decline.id } })).status,
    'rejected',
  );
  assert.equal((await get(shop, '/wallet')).body.availableCents, '80000');
});
test('two reservations cannot spend the same balance; closing 800/720 releases 80 once', async () => {
  const a = await delivery(80000),
    b = await delivery(80000);
  const results = await Promise.all([
    post(admin, '/reservations/delivery', { deliveryId: a.id }),
    post(second, '/reservations/delivery', { deliveryId: b.id }),
  ]);
  assert.deepEqual(results.map((x) => x.status).sort(), [201, 409]);
  const reserved = results.find((x) => x.status === 201)!.body;
  assert.equal((await get(shop, '/wallet')).body.availableCents, '0');
  assert.equal((await get(shop, '/wallet')).body.reservedCents, '80000');
  await post(shop, `/reservations/${reserved.id}/close`, { consumedCents: '72000', reason }).expect(
    403,
  );
  await post(admin, `/wallets/${f.store.id}`, { enabled: false, reason }).expect(201);
  await post(admin, `/reservations/${reserved.id}/close`, {
    consumedCents: '80001',
    reason,
  }).expect(400);
  await post(admin, `/reservations/${reserved.id}/close`, {
    consumedCents: '72000',
    reason,
  }).expect(201);
  await post(second, `/reservations/${reserved.id}/close`, {
    consumedCents: '72000',
    reason,
  }).expect(201);
  await post(second, `/reservations/${reserved.id}/close`, {
    consumedCents: '71999',
    reason,
  }).expect(409);
  const view = (await get(shop, '/wallet')).body;
  assert.equal(view.availableCents, '8000');
  assert.equal(view.reservedCents, '0');
  await post(admin, '/topups', {
    establishmentId: f.store.id,
    amountCents: '100',
    scenario: 'approve',
    reference: randomUUID(),
    reason,
  }).expect(409);
  await post(admin, `/wallets/${f.store.id}`, { enabled: true, reason }).expect(201);
  const statement = (await get(shop, '/statement')).body.items;
  assert.ok(
    statement.some((x: { availableDeltaCents: string }) => x.availableDeltaCents === '8000'),
  );
  assert.ok(!JSON.stringify(statement).includes('expense'));
  const key = randomUUID();
  await post(
    admin,
    '/topups',
    {
      establishmentId: f.store.id,
      amountCents: '100',
      scenario: 'approve',
      reference: randomUUID(),
      reason,
    },
    key,
  ).expect(201);
  await post(
    second,
    '/topups',
    {
      establishmentId: f.store.id,
      amountCents: '200',
      scenario: 'approve',
      reference: randomUUID(),
      reason,
    },
    key,
  ).expect(409);
});
test('database rejects unbalanced or editable postings and negative prepaid balances', async () => {
  const header = await db.ledgerTransaction.findFirstOrThrow({ where: { tenantId: f.tenant.id } });
  const entry = await db.ledgerEntry.findFirstOrThrow({ where: { transactionId: header.id } });
  await assert.rejects(db.ledgerEntry.update({ where: { id: entry.id }, data: { amount: 1n } }));
  await assert.rejects(db.ledgerEntry.delete({ where: { id: entry.id } }));
  await assert.rejects(
    db.ledgerTransaction.update({ where: { id: header.id }, data: { description: 'Reescrever' } }),
  );
  await assert.rejects(db.ledgerTransaction.delete({ where: { id: header.id } }));
  await assert.rejects(
    atomic(db, async (tx) => {
      await financeLock(tx, f.tenant.id);
      const moved = await tx.ledgerTransaction.create({
        data: {
          tenantId: f.tenant.id,
          actorId: f.admin.id,
          source: randomUUID(),
          description: 'Move immutable entries',
        },
      });
      await tx.ledgerEntry.updateMany({
        where: { transactionId: header.id },
        data: { transactionId: moved.id },
      });
      await tx.ledgerTransaction.update({ where: { id: moved.id }, data: { status: 'posted' } });
    }),
  );

  await assert.rejects(
    atomic(db, async (tx) => {
      await financeLock(tx, f.tenant.id);
      const acc = await account(tx, f.tenant.id, 'cash');
      const t = await tx.ledgerTransaction.create({
        data: {
          tenantId: f.tenant.id,
          actorId: f.admin.id,
          source: randomUUID(),
          description: 'Invalid',
          status: 'draft',
        },
      });
      await tx.ledgerEntry.create({
        data: { tenantId: f.tenant.id, transactionId: t.id, accountId: acc.id, amount: 100n },
      });
      await tx.ledgerTransaction.update({ where: { id: t.id }, data: { status: 'posted' } });
    }),
  );
  await assert.rejects(
    db.ledgerTransaction.create({
      data: {
        tenantId: f.tenant.id,
        actorId: f.admin.id,
        source: randomUUID(),
        description: 'Empty posted',
        status: 'posted',
      },
    }),
  );
  await assert.rejects(
    atomic(db, async (tx) => {
      await financeLock(tx, f.tenant.id);
      const a = await account(tx, f.tenant.id, 'available', f.store.id),
        b = await account(tx, f.tenant.id, 'revenue');
      await ledgerPost(tx, f.tenant.id, f.admin.id, randomUUID(), 'Overdraft', a.id, b.id, 999999n);
    }),
  );
  const sums = await db.$queryRaw<
    Array<{ total: bigint }>
  >`SELECT sum(amount)::bigint AS total FROM "LedgerEntry" WHERE "tenantId"=${f.tenant.id}::uuid GROUP BY "transactionId"`;
  assert.ok(sums.length > 0 && sums.every((x) => x.total === 0n));
});
test('expired worker lease consults before resubmission; restarts retain fake-provider acceptance', async () => {
  const t = await topup('900', 'approve');
  await db.financeTask.update({
    where: { tenantId_topupId: { tenantId: f.tenant.id, topupId: t.id } },
    data: { status: 'processing', attempts: 1, leaseToken: randomUUID(), leaseUntil: new Date(0) },
  });
  await app.get(FinanceWorker).run(f.tenant.id);
  assert.equal(
    (await db.financeTopup.findUniqueOrThrow({ where: { id: t.id } })).status,
    'confirmed',
  );
  assert.equal(
    await db.financeSandboxReceipt.count({ where: { tenantId: f.tenant.id, topupId: t.id } }),
    1,
  );
  const oldBalance = await balance(db, f.tenant.id, f.store.id, 'available');
  await app.get(FinanceWorker).run(f.tenant.id);
  assert.equal(await balance(db, f.tenant.id, f.store.id, 'available'), oldBalance);
});
test('weekly minimum is unique and uses accepted terms, never operational delivery freight twice', async () => {
  await topup('100000');
  await post(admin, '/process').expect(201);
  const terms = {
    timezone: 'America/Sao_Paulo',
    coverage: 'Franca-SP',
    servicePolicy: 'Disponibilidade comprovada',
    weeklyAvailabilityCents: 60000,
    platformFeeCents: 1000,
    deliveryFeeCents: 200,
    payModel: 'fixed',
    courierFixedCents: 5000,
    courierDeliveryCents: 0,
    templates: [
      { weekday: 1, startMinute: 1080, endMinute: 1380, courierCount: 2, expectedDeliveries: 100 },
    ],
  };
  const c = await db.merchantContract.create({
    data: { tenantId: f.tenant.id, establishmentId: f.store.id, title: 'Semanal' },
  });
  const v = await db.contractVersion.create({
    data: {
      tenantId: f.tenant.id,
      contractId: c.id,
      number: 1,
      status: 'accepted',
      terms,
      effectiveFrom: new Date('2030-01-01T03:00:00Z'),
      effectiveTo: new Date('2030-02-01T03:00:00Z'),
    },
  });
  const requestBody = { versionId: v.id, week: '2030-01-07' };
  const a = await post(admin, '/reservations/week', requestBody).expect(201),
    b = await post(second, '/reservations/week', requestBody).expect(201);
  assert.equal(a.body.id, b.body.id);
  assert.equal(a.body.amount, '61000');
  await post(admin, '/reservations/week', { ...requestBody, week: '2030-01-28' }).expect(400);
  const d = await delivery(9000);
  await db.delivery.update({
    where: { id: d.id },
    data: { createdAt: new Date('2030-01-08T12:00:00Z') },
  });
  const dr = await post(admin, '/reservations/delivery', { deliveryId: d.id }).expect(201);
  assert.equal(dr.body.amount, '200');
  await post(admin, '/reservations/delivery', { deliveryId: d.id }).expect(201);
  assert.equal(
    await db.financeReservation.count({ where: { tenantId: f.tenant.id, deliveryId: d.id } }),
    1,
  );
  await get(courier, '/wallet').expect(403);
});
