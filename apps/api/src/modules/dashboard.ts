import { BadRequestException, Controller, Get, Inject, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Database } from '../database.js';
import { ListDto } from '../http/dto.js';
import type { AuthRequest } from '../http/security.js';
import { deliveryScope } from './deliveries.js';
import { atomic } from './transactions.js';
@ApiTags('Indicadores')
@Controller('dashboard')
export class DashboardController {
  constructor(@Inject(Database) private db: Database) {}
  @Get() async get(@Req() r: AuthRequest, @Query() q: ListDto) {
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const from = q.from ? new Date(q.from) : new Date(`${day}T00:00:00-03:00`);
    const to = q.to ? new Date(q.to) : new Date();
    if (from > to) throw new BadRequestException('Período inválido.');
    return atomic(this.db, async (tx) => {
      const scope = deliveryScope(r.actor);
      const delivered = {
        ...scope,
        status: 'delivered' as const,
        updatedAt: { gte: from, lte: to },
      };
      const stages = await tx.delivery.groupBy({
        by: ['status'],
        where: { ...scope, status: { not: 'delivered' } },
        _count: { _all: true },
      });
      const done = await tx.delivery.aggregate({
        where: delivered,
        _count: { _all: true },
        _sum: { feeCents: true, courierPayoutCents: true },
      });
      const activeFees = await tx.delivery.aggregate({
        where: { ...scope, status: { not: 'delivered' } },
        _sum: { feeCents: true, courierPayoutCents: true },
      });
      const stores = await (r.actor.role === 'admin'
        ? tx.establishment.groupBy({
            by: ['lifecycleStatus'],
            where: { tenantId: r.actor.tenantId },
            _count: { _all: true },
          })
        : Promise.resolve([]));
      const couriers = await (r.actor.role === 'admin'
        ? tx.courier.groupBy({
            by: ['approvalStatus', 'availabilityStatus'],
            where: { tenantId: r.actor.tenantId },
            _count: { _all: true },
          })
        : Promise.resolve([]));
      return {
        period: { from, to },
        active: stages.reduce((s, g) => s + g._count._all, 0),
        delivered: done._count._all,
        completedFreightCents: r.actor.role === 'courier' ? undefined : (done._sum.feeCents ?? 0),
        expectedPayoutCents:
          r.actor.role === 'courier' ? (done._sum.courierPayoutCents ?? 0) : undefined,
        activeFreightCents:
          r.actor.role === 'courier'
            ? (activeFees._sum.courierPayoutCents ?? 0)
            : (activeFees._sum.feeCents ?? 0),
        stages: stages.map((g) => ({ status: g.status, count: g._count._all })),
        establishments: stores.map((g) => ({ status: g.lifecycleStatus, count: g._count._all })),
        couriers: couriers.map((g) => ({
          approval: g.approvalStatus,
          availability: g.availabilityStatus,
          count: g._count._all,
        })),
      };
    });
  }
}
