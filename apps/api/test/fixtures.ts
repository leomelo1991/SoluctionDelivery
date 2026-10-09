import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import type { Database } from '../src/database.js';
export const testPassword = 'Fixture-Password-2026!';
export const address = {
  street: 'Rua das Flores',
  number: '120',
  district: 'Centro',
  city: 'São Paulo',
  state: 'SP',
  postalCode: '01001000',
};
export async function fixture(db: Database, slug = `test-${randomUUID()}`) {
  const hash = await argon2.hash(testPassword);
  return db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { slug, name: 'Empresa de testes' } });
    const store = await tx.establishment.create({
      data: {
        tenantId: tenant.id,
        name: 'Loja de testes',
        responsible: 'Responsável',
        phone: '11999990000',
        email: 'loja@example.test',
        city: address.city,
        address,
        lifecycleStatus: 'active',
        operationOpen: true,
      },
    });
    const otherStore = await tx.establishment.create({
      data: {
        tenantId: tenant.id,
        name: 'Outra loja',
        responsible: 'Responsável',
        phone: '11999990000',
        email: 'outra@example.test',
        city: address.city,
        address,
        lifecycleStatus: 'active',
        operationOpen: true,
      },
    });
    const courier = await tx.courier.create({
      data: {
        tenantId: tenant.id,
        name: 'Entregador um',
        phone: '11999990001',
        vehicle: 'motorcycle',
        approvalStatus: 'approved',
        availabilityStatus: 'available',
      },
    });
    const second = await tx.courier.create({
      data: {
        tenantId: tenant.id,
        name: 'Entregador dois',
        phone: '11999990002',
        vehicle: 'bicycle',
        approvalStatus: 'approved',
        availabilityStatus: 'available',
      },
    });
    const create = (
      role: 'admin' | 'establishment' | 'courier',
      email: string,
      link: object = {},
    ) =>
      tx.user.create({
        data: {
          tenantId: tenant.id,
          name: email.split('@')[0],
          email,
          role,
          passwordHash: hash,
          mustChangePassword: false,
          ...link,
        },
      });
    const admin = await create('admin', 'admin@example.test');
    const operator = await create('establishment', 'loja@example.test', {
      establishmentId: store.id,
    });
    const courierUser = await create('courier', 'entregador@example.test', {
      courierId: courier.id,
    });
    const secondUser = await create('courier', 'segundo@example.test', { courierId: second.id });
    const region = await tx.region.create({
      data: {
        tenantId: tenant.id,
        name: 'Centro',
        city: address.city,
        coverage: 'Centro de testes',
        feeCents: 1000,
        payoutCents: 800,
      },
    });
    await tx.pricingConfig.create({
      data: {
        tenantId: tenant.id,
        fee: { baseCents: 500, includedMeters: 1000, perKmCents: 200, minimumCents: 700 },
        payout: { baseCents: 400, includedMeters: 1000, perKmCents: 150, minimumCents: 500 },
      },
    });
    return {
      tenant,
      store,
      otherStore,
      courier,
      second,
      admin,
      operator,
      courierUser,
      secondUser,
      region,
    };
  });
}
export async function cleanup(db: Database, tenantId: string) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.slug.startsWith('test-') && !tenant?.slug.startsWith('e2e-'))
    throw new Error('Refusing to clean non-test data');
  await db.$transaction(async (tx) => {
    await tx.financeWorkspace.deleteMany({ where: { tenantId } });
    await tx.mapGeocode.deleteMany({ where: { tenantId } });
    await tx.courierPosition.deleteMany({ where: { tenantId } });
    await tx.attendanceEvent.deleteMany({ where: { tenantId } });
    await tx.courierAllocation.deleteMany({ where: { tenantId } });
    await tx.scheduledShift.deleteMany({ where: { tenantId } });
    await tx.contractVersion.deleteMany({ where: { tenantId } });
    await tx.merchantContract.deleteMany({ where: { tenantId } });
    await tx.session.deleteMany({ where: { tenantId } });
    await tx.deliveryEvent.deleteMany({ where: { tenantId } });
    await tx.deliveryOffer.deleteMany({ where: { tenantId } });
    await tx.externalOrder.deleteMany({ where: { tenantId } });
    await tx.delivery.deleteMany({ where: { tenantId } });
    await tx.cRMNote.deleteMany({ where: { tenantId } });
    await tx.user.deleteMany({ where: { tenantId } });
    await tx.courier.deleteMany({ where: { tenantId } });
    await tx.establishment.deleteMany({ where: { tenantId } });
    await tx.quote.deleteMany({ where: { tenantId } });
    await tx.idempotency.deleteMany({ where: { tenantId } });
    await tx.auditEvent.deleteMany({ where: { tenantId } });
    await tx.region.deleteMany({ where: { tenantId } });
    await tx.surcharge.deleteMany({ where: { tenantId } });
    await tx.pricingConfig.deleteMany({ where: { tenantId } });
    await tx.tenant.delete({ where: { id: tenantId } });
  });
}
