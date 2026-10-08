import { randomUUID } from 'node:crypto';
import type { Database } from '../src/database.js';
import { seedDemo } from './demo-seed.js';
import { localizeInvestors } from './investor-franca.js';

const batch = 'investor-presentation-v1';
const phases = ['waiting', 'assigned', 'accepted', 'arrived', 'collected', 'delivered'] as const;
const reason =
  'Dados inteiramente fictícios para apresentação; não representam tração ou receita real.';

export async function seedInvestors(
  db: Database,
  password: string,
  slug = 'investidores',
  now = new Date(),
) {
  if (slug === 'demo') throw new Error('Use uma empresa exclusiva para apresentação.');
  await seedDemo(db, password, slug);
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731904282)::text`;
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { slug } });
      const tenantId = tenant.id;
      const prior = await tx.auditEvent.findFirst({ where: { tenantId, action: batch } });
      if (prior) return localizeInvestors(tx, tenantId);
      const seeded = await tx.auditEvent.findFirst({ where: { tenantId, action: 'demo_seed' } });
      if (!seeded || (await tx.delivery.count({ where: { tenantId } })))
        throw new Error('A empresa já contém dados não pertencentes a esta apresentação.');
      const admin = await tx.user.findFirstOrThrow({ where: { tenantId, role: 'admin' } });
      const operator = await tx.user.findFirstOrThrow({
        where: { tenantId, role: 'establishment' },
      });
      const driver = await tx.user.findFirstOrThrow({ where: { tenantId, role: 'courier' } });
      const mainStore = await tx.establishment.findUniqueOrThrow({
        where: { id: operator.establishmentId! },
      });
      const mainCourier = await tx.courier.findUniqueOrThrow({ where: { id: driver.courierId! } });
      await tx.tenant.update({
        where: { id: tenantId },
        data: { name: 'Apresentação — dados fictícios' },
      });
      const stores = [mainStore];
      const names = [
        'Bistrô Aurora',
        'Mercado Jardim',
        'Farmácia Horizonte',
        'Padaria Estação',
        'Sushi Alameda',
        'Floricultura Primavera',
        'Pet Vila',
        'Empório Central',
        'Pizzaria Mirante',
      ];
      for (const [i, name] of names.entries()) {
        stores.push(
          await tx.establishment.create({
            data: {
              tenantId,
              name: name + ' (fictício)',
              responsible: 'Contato demonstrativo',
              phone: '11000000000',
              email: `parceiro${i + 1}@example.test`,
              city: 'São Paulo',
              address: {
                street: 'Rua de Demonstração',
                number: String(100 + i),
                district: 'Centro',
                city: 'São Paulo',
                state: 'SP',
                postalCode: '01001000',
                complement: 'Endereço fictício',
              },
              lifecycleStatus: i < 6 ? 'active' : 'lead',
              operationOpen: i < 6,
              acquisitionChannel: 'direct',
              createdAt: new Date(now.getTime() - (60 - i * 3) * 86400000),
            },
          }),
        );
      }
      for (const [i, store] of stores.entries()) {
        await tx.cRMNote.create({
          data: {
            tenantId,
            establishmentId: store.id,
            authorUserId: admin.id,
            authorName: admin.name,
            text: `${reason} Cenário comercial: ${i < 7 ? 'parceiro ativo com acompanhamento de operação e revisão de tarifas.' : 'prospecção com reunião de apresentação agendada.'}`,
          },
        });
      }
      const couriers = [mainCourier];
      for (let i = 1; i < 14; i++) {
        couriers.push(
          await tx.courier.create({
            data: {
              tenantId,
              name: `Entregador demonstrativo ${String(i + 1).padStart(2, '0')}`,
              phone: '11000000000',
              vehicle: i % 3 === 0 ? 'bicycle' : 'motorcycle',
              approvalStatus: i < 12 ? 'approved' : 'pending',
              availabilityStatus: i < 10 ? 'available' : 'offline',
            },
          }),
        );
      }
      for (const [i, name] of ['Jardins', 'Vila Mariana', 'Pinheiros', 'Bela Vista'].entries()) {
        await tx.region.create({
          data: {
            tenantId,
            name,
            city: 'São Paulo',
            coverage: 'Cobertura fictícia para apresentação',
            feeCents: 1100 + i * 200,
            payoutCents: 800 + i * 150,
          },
        });
      }
      const regions = await tx.region.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
      const deliveries = [];
      const events = [];
      const offers = [];
      // Historical growth is synthetic: 5 to 13 completed deliveries/day, plus 12 active orders.
      const targets: { status: (typeof phases)[number]; time: Date; courier: number }[] = [];
      for (let day = 59; day >= 0; day--) {
        const count = 5 + Math.floor((59 - day) / 7);
        for (let j = 0; j < count; j++)
          targets.push({
            status: 'delivered',
            time: new Date(now.getTime() - day * 86400000 - j * 180000),
            courier: j % 10,
          });
      }
      for (let i = 0; i < 12; i++)
        targets.push({ status: phases[i < 4 ? 0 : 1 + ((i - 4) % 4)], time: now, courier: i - 4 });
      for (const [i, target] of targets.entries()) {
        const store = stores[i % 7];
        const region = regions[i % regions.length];
        const id = randomUUID();
        const stage = phases.indexOf(target.status);
        const courierId = stage > 0 ? couriers[target.courier].id : null;
        const createdAt = new Date(target.time.getTime() - (stage * 5 + 4) * 60000);
        const updatedAt = new Date(createdAt.getTime() + stage * 5 * 60000);
        deliveries.push({
          id,
          tenantId,
          establishmentId: store.id,
          courierId,
          status: target.status,
          recipientName: `Cliente fictício ${String(i + 1).padStart(4, '0')}`,
          recipientPhone: '11000000000',
          pickupAddress: store.address!,
          destinationAddress: {
            street: 'Alameda Demonstrativa',
            number: String(10 + (i % 200)),
            district: region.name,
            city: 'São Paulo',
            state: 'SP',
            postalCode: '01001000',
            complement: 'Não utilizar para entrega real',
          },
          notes: reason,
          pickupReady: true,
          feeCents: region.feeCents,
          courierPayoutCents: region.payoutCents,
          pricingSnapshot: {
            demo: true,
            batch,
            method: 'region',
            regionId: region.id,
            regionName: region.name,
            baseFeeCents: region.feeCents,
            basePayoutCents: region.payoutCents,
            feeCents: region.feeCents,
            payoutCents: region.payoutCents,
            surcharges: [],
          },
          version: stage + 1,
          createdAt,
          updatedAt,
        });
        for (let j = 0; j <= stage; j++)
          events.push({
            tenantId,
            deliveryId: id,
            previousStatus: j ? phases[j - 1] : null,
            newStatus: phases[j],
            actorUserId: admin.id,
            origin: 'admin',
            reason,
            createdAt: new Date(createdAt.getTime() + j * 300000),
          });
        if (courierId)
          offers.push({
            tenantId,
            deliveryId: id,
            courierId,
            origin: 'manual',
            status: stage === 1 ? 'pending' : 'accepted',
            createdAt: new Date(createdAt.getTime() + 300000),
            respondedAt: stage > 1 ? new Date(createdAt.getTime() + 600000) : null,
          });
      }
      await tx.delivery.createMany({ data: deliveries });
      await tx.deliveryEvent.createMany({ data: events });
      await tx.deliveryOffer.createMany({ data: offers });
      await tx.courier.updateMany({
        where: { tenantId, id: { in: couriers.slice(0, 8).map((c) => c.id) } },
        data: { availabilityStatus: 'busy' },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorUserId: admin.id,
          entity: 'tenant',
          entityId: batch,
          action: batch,
          reason,
          changes: {
            synthetic: true,
            establishments: stores.length,
            couriers: couriers.length,
            deliveries: deliveries.length,
            active: 12,
            seededAt: now.toISOString(),
          },
        },
      });
      await localizeInvestors(tx, tenantId);
      return true;
    },
    { timeout: 120000, maxWait: 15000 },
  );
}
