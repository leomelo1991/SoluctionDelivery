import { Database } from '../src/database.js';
import { config } from '../src/config.js';
import { atomic, json } from '../src/modules/transactions.js';
import { pricingState } from '../src/modules/pricing.js';
import { distancePrice, withSurcharges, type Formula } from '../src/domain/pricing.js';
import { activeStatuses, type Stage } from '../src/domain/deliveries.js';
import type { AddressDto } from '../src/http/dto.js';

if (config.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true')
  throw new Error('Dados fictícios permitidos somente fora de produção com ALLOW_DEMO_SEED=true.');
const batch = 'demo-deliveries-v1';
const reason = 'Simulação autorizada de entregas fictícias para testar os três painéis.';
const db = new Database();
try {
  const result = await atomic(db, async (tx) => {
    // One atomic batch; repeat execution never creates duplicate demo deliveries.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${batch}))`;
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { slug: 'demo' } });
    if (!tenant.active) throw new Error('A empresa demo está desativada.');
    const prior = await tx.auditEvent.findFirst({
      where: { tenantId: tenant.id, action: 'demo_deliveries_seed', entityId: batch },
    });
    if (prior) return { created: false, summary: prior.changes };
    const admin = await tx.user.findFirstOrThrow({
      where: { tenantId: tenant.id, email: 'admin@example.test', role: 'admin', active: true },
    });
    const operator = await tx.user.findFirstOrThrow({
      where: {
        tenantId: tenant.id,
        email: 'loja@example.test',
        role: 'establishment',
        active: true,
      },
    });
    const courierUser = await tx.user.findFirstOrThrow({
      where: {
        tenantId: tenant.id,
        email: 'entregador@example.test',
        role: 'courier',
        active: true,
      },
    });
    if (!operator.establishmentId || !courierUser.courierId)
      throw new Error('Vínculos das contas demo ausentes.');
    const store = await tx.establishment.findUniqueOrThrow({
      where: { tenantId_id: { tenantId: tenant.id, id: operator.establishmentId } },
    });
    const main = await tx.courier.findUniqueOrThrow({
      where: { tenantId_id: { tenantId: tenant.id, id: courierUser.courierId } },
    });
    if (
      store.lifecycleStatus !== 'active' ||
      !store.operationOpen ||
      main.approvalStatus !== 'approved'
    )
      throw new Error('A loja demo precisa estar aberta e o entregador aprovado.');
    const region = await tx.region.findFirstOrThrow({
      where: { tenantId: tenant.id, active: true, city: store.city },
      orderBy: { name: 'asc' },
    });
    const state = await pricingState(tx, tenant.id, region.id);
    if (!state.config) throw new Error('Configure a fórmula de distância da empresa demo.');
    const occupied = await tx.delivery.count({
      where: { tenantId: tenant.id, courierId: main.id, status: { in: [...activeStatuses] } },
    });
    const direct = occupied === 0 && main.availabilityStatus === 'available';
    const helpers = [];
    for (const name of ['Ana — teste', 'Bruno — teste', 'Carla — teste']) {
      const helper = await tx.courier.create({
        data: {
          tenantId: tenant.id,
          name,
          phone: '11900000000',
          vehicle: 'motorcycle',
          approvalStatus: 'approved',
          availabilityStatus: 'busy',
        },
      });
      helpers.push(helper);
      await tx.auditEvent.create({
        data: {
          tenantId: tenant.id,
          actorUserId: admin.id,
          entity: 'courier',
          entityId: helper.id,
          action: 'demo_courier_seed',
          changes: { batch, name },
          reason,
        },
      });
    }
    const targets: { status: Stage; courierId?: string; name: string }[] = [
      ...Array.from({ length: 8 }, (_, i) => ({
        status: 'waiting' as const,
        name: `Cliente teste — oferta ${i + 1}`,
      })),
      {
        status: direct ? 'assigned' : 'waiting',
        courierId: direct ? main.id : undefined,
        name: 'Cliente teste — aceite no app',
      },
      { status: 'accepted', courierId: helpers[0].id, name: 'Cliente teste — entrega aceita' },
      { status: 'arrived', courierId: helpers[1].id, name: 'Cliente teste — aguardando retirada' },
      { status: 'collected', courierId: helpers[2].id, name: 'Cliente teste — em rota' },
      ...Array.from({ length: 3 }, (_, i) => ({
        status: 'delivered' as const,
        courierId: main.id,
        name: `Cliente teste — concluída ${i + 1}`,
      })),
    ];
    const phases: Stage[] = [
      'waiting',
      'assigned',
      'accepted',
      'arrived',
      'collected',
      'delivered',
    ];
    const addresses = ['Rua das Flores', 'Rua da Praça', 'Rua do Mercado', 'Rua da Vila'];
    const pickup = store.address as unknown as AddressDto;
    const summary = [];
    const now = Date.now();
    for (const [i, target] of targets.entries()) {
      const method = i % 2 === 0 ? 'region' : 'distance';
      const distanceM = 2000 + i * 350;
      const baseFee =
        method === 'region'
          ? region.feeCents
          : distancePrice(distanceM, state.config.fee as unknown as Formula);
      const basePayout =
        method === 'region'
          ? region.payoutCents
          : distancePrice(distanceM, state.config.payout as unknown as Formula);
      const feeCents = withSurcharges(
        baseFee,
        state.surcharges.map((s) => ({ fixedCents: s.feeFixedCents, percentBps: s.feePercentBps })),
      );
      const payoutCents = withSurcharges(
        basePayout,
        state.surcharges.map((s) => ({
          fixedCents: s.payoutFixedCents,
          percentBps: s.payoutPercentBps,
        })),
      );
      const timeline = phases.slice(0, phases.indexOf(target.status) + 1);
      const createdAt = new Date(now - (timeline.length - 1) * 60000);
      const delivery = await tx.delivery.create({
        data: {
          tenantId: tenant.id,
          establishmentId: store.id,
          courierId: target.courierId,
          status: target.status,
          recipientName: target.name,
          recipientPhone: '11900000000',
          pickupAddress: json(pickup),
          destinationAddress: json({
            ...pickup,
            street: addresses[i % addresses.length],
            number: String(150 + i * 12),
            district: region.name,
            complement: 'Endereço fictício para demonstração',
          }),
          notes: `Pedido fictício de teste ${i + 1}. ${i % 2 === 0 ? 'Retirada no balcão; pacote lacrado.' : 'Conferir identificação do pedido na coleta.'}`,
          pickupReady: i % 3 !== 0,
          manualDistanceM: method === 'distance' ? distanceM : undefined,
          distanceSource: method === 'distance' ? 'manual' : '',
          feeCents,
          courierPayoutCents: payoutCents,
          version: timeline.length,
          createdAt,
          updatedAt: new Date(now),
          pricingSnapshot: json({
            demo: true,
            batch,
            method,
            regionId: method === 'region' ? region.id : null,
            regionName: method === 'region' ? region.name : null,
            formulaVersion: state.config.version,
            baseFeeCents: baseFee,
            basePayoutCents: basePayout,
            feeCents,
            payoutCents,
            surcharges: state.surcharges,
            provider: method === 'distance' ? 'manual' : null,
            manualReason:
              method === 'distance' ? 'Distância fictícia do cenário de demonstração.' : null,
          }),
        },
      });
      for (const [j, status] of timeline.entries())
        await tx.deliveryEvent.create({
          data: {
            tenantId: tenant.id,
            deliveryId: delivery.id,
            previousStatus: j === 0 ? null : timeline[j - 1],
            newStatus: status,
            actorUserId: admin.id,
            origin: 'admin',
            reason,
            createdAt: new Date(createdAt.getTime() + j * 60000),
          },
        });
      if (target.courierId)
        await tx.deliveryOffer.create({
          data: {
            tenantId: tenant.id,
            deliveryId: delivery.id,
            courierId: target.courierId,
            origin: 'manual',
            status: target.status === 'assigned' ? 'pending' : 'accepted',
            respondedAt: target.status === 'assigned' ? undefined : new Date(now),
          },
        });
      await tx.auditEvent.create({
        data: {
          tenantId: tenant.id,
          actorUserId: admin.id,
          entity: 'delivery',
          entityId: delivery.id,
          action: 'demo_delivery_seed',
          changes: { batch, code: delivery.code, status: target.status },
          reason,
        },
      });
      summary.push({
        code: delivery.code,
        status: target.status,
        recipientName: target.name,
        feeCents,
        payoutCents,
      });
    }
    if (direct)
      await tx.courier.update({ where: { id: main.id }, data: { availabilityStatus: 'busy' } });
    await tx.cRMNote.create({
      data: {
        tenantId: tenant.id,
        establishmentId: store.id,
        authorUserId: admin.id,
        authorName: admin.name,
        text: 'Criados 15 pedidos fictícios para testar ofertas, aceite, retirada, conclusão e histórico nos três painéis. Entregadores auxiliares são cadastros de demonstração.',
      },
    });
    await tx.auditEvent.create({
      data: {
        tenantId: tenant.id,
        actorUserId: admin.id,
        entity: 'tenant',
        entityId: batch,
        action: 'demo_deliveries_seed',
        changes: json({
          store: store.name,
          total: summary.length,
          directedOffer: direct,
          deliveries: summary,
        }),
        reason,
      },
    });
    return { created: true, summary };
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await db.$disconnect();
}
