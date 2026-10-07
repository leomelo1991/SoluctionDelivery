import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Database } from '../database.js';
import { Prisma, type Delivery } from '../generated/prisma/client.js';
import { Roles, type Actor, type AuthRequest } from '../http/security.js';
import { CreateDeliveryDto, DeliveryActionDto, ListDto } from '../http/dto.js';
import { activeStatuses, canTransition, type Stage } from '../domain/deliveries.js';
import { audit, command, inputHash, json } from './transactions.js';
import { pricingState, quoteInput } from './pricing.js';
export function deliveryScope(a: Actor): Prisma.DeliveryWhereInput {
  return {
    tenantId: a.tenantId,
    ...(a.role === 'establishment'
      ? { establishmentId: a.establishmentId! }
      : a.role === 'courier'
        ? { courierId: a.courierId! }
        : {}),
  };
}
const conflict = (code: string, message: string) => new ConflictException({ code, message });
function visible<T extends Delivery & { courier?: unknown }>(a: Actor, d: T) {
  if (a.role !== 'courier') return d;
  const { feeCents: _fee, pricingSnapshot: _pricing, courier: _courier, ...safe } = d;
  if (d.status === 'assigned' || d.status === 'waiting') {
    const {
      recipientName: _name,
      recipientPhone: _phone,
      destinationAddress: destination,
      notes: _notes,
      ...offer
    } = safe;
    const region = destination as Record<string, unknown>;
    return { ...offer, destinationRegion: { city: region.city, district: region.district } };
  }
  return safe;
}
@Injectable()
export class DeliveryService {
  constructor(@Inject(Database) private db: Database) {}
  async create(a: Actor, b: CreateDeliveryDto, key?: string) {
    if (
      a.role === 'courier' ||
      (a.role === 'establishment' && a.establishmentId !== b.establishmentId)
    )
      throw new ForbiddenException();
    return command(this.db, a, key, 'delivery:create', b, async (tx) => {
      const store = await tx.establishment.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: a.tenantId, id: b.establishmentId } },
      });
      if (store.lifecycleStatus !== 'active' || !store.operationOpen)
        throw new BadRequestException({
          code: 'OPERATION_CLOSED',
          message: 'O estabelecimento está com a operação fechada.',
        });
      const quote = await tx.quote.findFirst({
        where: { id: b.quoteId, tenantId: a.tenantId, userId: a.id, establishmentId: store.id },
      });
      if (!quote || quote.consumed || quote.expiresAt <= new Date())
        throw conflict('QUOTE_EXPIRED', 'Cotação vencida ou já utilizada. Calcule novamente.');
      const snapshot = quote.snapshot as Record<string, unknown>;
      const state = await pricingState(tx, a.tenantId, b.regionId);
      if (
        quote.inputHash !== inputHash(quoteInput(b)) ||
        snapshot.fingerprint !== state.fingerprint ||
        snapshot.pickupHash !== inputHash(store.address)
      )
        throw conflict(
          'QUOTE_CHANGED',
          'Os dados ou tarifas mudaram. Calcule e confirme uma nova cotação.',
        );
      const delivery = await tx.delivery.create({
        data: {
          tenantId: a.tenantId,
          establishmentId: store.id,
          recipientName: b.recipientName,
          recipientPhone: b.recipientPhone,
          pickupAddress: json(store.address),
          destinationAddress: json(b.destinationAddress),
          notes: b.notes ?? '',
          pickupReady: b.pickupReady ?? false,
          manualDistanceM: b.manualDistanceM,
          distanceSource: String(snapshot.provider ?? ''),
          feeCents: quote.feeCents,
          courierPayoutCents: quote.payoutCents,
          pricingSnapshot: json(snapshot),
        },
      });
      await tx.quote.update({ where: { id: quote.id }, data: { consumed: true } });
      await tx.deliveryEvent.create({
        data: {
          tenantId: a.tenantId,
          deliveryId: delivery.id,
          newStatus: 'waiting',
          actorUserId: a.id,
          origin: a.role,
        },
      });
      await audit(tx, a, 'delivery', delivery.id, 'created', {
        code: delivery.code,
        feeCents: delivery.feeCents,
      });
      return delivery;
    });
  }
  async action(a: Actor, id: string, action: string, b: DeliveryActionDto, key?: string) {
    return command(this.db, a, key, `delivery:${id}:${action}`, b, async (tx) => {
      const d = await tx.delivery.findFirst({ where: { ...deliveryScope(a), id } });
      // Open offers are not yet linked to a courier, so only accept/decline may access them.
      const delivery =
        d ??
        (a.role === 'courier' && ['accept', 'decline'].includes(action)
          ? await tx.delivery.findFirst({ where: { id, tenantId: a.tenantId, status: 'waiting' } })
          : null);
      if (!delivery) {
        if (a.role === 'courier' && ['accept', 'decline'].includes(action)) {
          const existing = await tx.delivery.findFirst({
            where: { id, tenantId: a.tenantId },
            select: { status: true },
          });
          if (existing && existing.status !== 'assigned')
            throw conflict('OFFER_UNAVAILABLE', 'Esta oferta não está mais disponível.');
        }
        throw new NotFoundException();
      }
      if (delivery.version !== b.version)
        throw conflict('STALE_VERSION', 'A entrega mudou. Atualize antes de continuar.');
      const store = await tx.establishment.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: a.tenantId, id: delivery.establishmentId } },
      });
      let target: Stage = delivery.status;
      let courierId = delivery.courierId;
      let reason: string | undefined;
      if (action === 'assign') {
        if (a.role === 'courier') throw new ForbiddenException();
        if (delivery.status !== 'waiting')
          throw conflict('OFFER_UNAVAILABLE', 'A entrega já está vinculada.');
        if (!store.operationOpen || store.lifecycleStatus !== 'active')
          throw conflict('OPERATION_CLOSED', 'A operação está pausada.');
        if (!b.courierId) throw new BadRequestException('Informe o entregador.');
        courierId = b.courierId;
        target = 'assigned';
      } else if (action === 'accept' || action === 'decline') {
        if (a.role !== 'courier') throw new ForbiddenException();
        if (!['waiting', 'assigned'].includes(delivery.status))
          throw conflict('OFFER_UNAVAILABLE', 'Esta oferta não está mais disponível.');
        if (delivery.status === 'assigned' && delivery.courierId !== a.courierId)
          throw new ForbiddenException();
        if (
          delivery.status === 'waiting' &&
          (!store.operationOpen || store.lifecycleStatus !== 'active')
        )
          throw conflict('OPERATION_CLOSED', 'A operação está pausada.');
        const c = await tx.courier.findUniqueOrThrow({
          where: { tenantId_id: { tenantId: a.tenantId, id: a.courierId! } },
        });
        if (c.approvalStatus !== 'approved')
          throw new ForbiddenException({
            code: 'APPROVAL_REQUIRED',
            message: 'Seu cadastro não está aprovado.',
          });
        if (delivery.status === 'waiting' && c.availabilityStatus !== 'available')
          throw conflict('COURIER_UNAVAILABLE', 'Você precisa estar disponível.');
        const previous = await tx.deliveryOffer.findUnique({
          where: {
            tenantId_deliveryId_courierId: {
              tenantId: a.tenantId,
              deliveryId: id,
              courierId: c.id,
            },
          },
        });
        if (delivery.status === 'waiting' && previous?.status === 'declined')
          throw conflict('OFFER_DECLINED', 'Você já recusou esta oferta.');
        await tx.deliveryOffer.upsert({
          where: {
            tenantId_deliveryId_courierId: {
              tenantId: a.tenantId,
              deliveryId: id,
              courierId: c.id,
            },
          },
          create: {
            tenantId: a.tenantId,
            deliveryId: id,
            courierId: c.id,
            origin: delivery.status === 'assigned' ? 'manual' : 'open',
            status: action === 'accept' ? 'accepted' : 'declined',
            respondedAt: new Date(),
          },
          update: {
            status: action === 'accept' ? 'accepted' : 'declined',
            respondedAt: new Date(),
          },
        });
        if (action === 'decline') {
          await audit(tx, a, 'delivery', id, 'offer_declined', { courierId: c.id });
          if (delivery.status === 'waiting') return { id, status: 'waiting', declined: true };
          target = 'waiting';
          courierId = null;
          await tx.courier.update({
            where: { tenantId_id: { tenantId: a.tenantId, id: c.id } },
            data: { availabilityStatus: 'available' },
          });
        } else {
          target = 'accepted';
          courierId = c.id;
        }
      } else {
        const stages: Record<string, Stage> = {
          arrive: 'arrived',
          collect: 'collected',
          complete: 'delivered',
        };
        target = stages[action];
        if (!target) throw new BadRequestException('Ação inválida.');
        if (a.role === 'admin') {
          if (!b.reason)
            throw new BadRequestException({
              code: 'REASON_REQUIRED',
              message: 'Correção administrativa exige justificativa.',
            });
          reason = b.reason;
        } else if (a.role === 'establishment' && action !== 'collect')
          throw new ForbiddenException();
        if (!canTransition(delivery.status, target))
          throw conflict('INVALID_TRANSITION', 'Esta ação não está disponível na etapa atual.');
      }
      if (['assigned', 'accepted'].includes(target)) {
        const c = await tx.courier.findUniqueOrThrow({
          where: { tenantId_id: { tenantId: a.tenantId, id: courierId! } },
        });
        if (c.approvalStatus !== 'approved')
          throw conflict('APPROVAL_REQUIRED', 'Entregador não aprovado.');
        const other = await tx.delivery.count({
          where: {
            tenantId: a.tenantId,
            courierId: c.id,
            id: { not: id },
            status: { in: [...activeStatuses] },
          },
        });
        if (
          other ||
          (target === 'assigned' && c.availabilityStatus !== 'available') ||
          (target === 'accepted' &&
            delivery.status === 'waiting' &&
            c.availabilityStatus !== 'available')
        )
          throw conflict(
            'COURIER_BUSY',
            'O entregador não está disponível ou já tem outra entrega.',
          );
        await tx.courier.update({
          where: { tenantId_id: { tenantId: a.tenantId, id: c.id } },
          data: { availabilityStatus: 'busy' },
        });
        if (target === 'assigned')
          await tx.deliveryOffer.upsert({
            where: {
              tenantId_deliveryId_courierId: {
                tenantId: a.tenantId,
                deliveryId: id,
                courierId: c.id,
              },
            },
            create: { tenantId: a.tenantId, deliveryId: id, courierId: c.id, origin: 'manual' },
            update: { status: 'pending', origin: 'manual', respondedAt: null },
          });
        if (target === 'accepted')
          await tx.deliveryOffer.updateMany({
            where: {
              tenantId: a.tenantId,
              deliveryId: id,
              courierId: { not: c.id },
              status: 'pending',
            },
            data: { status: 'withdrawn', respondedAt: new Date() },
          });
      }
      const changed = await tx.delivery.updateMany({
        where: { id, tenantId: a.tenantId, version: b.version, status: delivery.status },
        data: { status: target, courierId, version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw conflict('STALE_VERSION', 'A entrega mudou. Atualize antes de continuar.');
      await tx.deliveryEvent.create({
        data: {
          tenantId: a.tenantId,
          deliveryId: id,
          previousStatus: delivery.status,
          newStatus: target,
          actorUserId: a.id,
          origin: a.role,
          reason,
        },
      });
      if (target === 'delivered')
        await tx.courier.update({
          where: { tenantId_id: { tenantId: a.tenantId, id: courierId! } },
          data: { availabilityStatus: 'available' },
        });
      await audit(
        tx,
        a,
        'delivery',
        id,
        action,
        { from: delivery.status, to: target, courierId },
        reason,
      );
      return visible(
        a,
        await tx.delivery.findUniqueOrThrow({
          where: { id },
          include: { establishment: { select: { id: true, name: true } } },
        }),
      );
    });
  }
}
@ApiTags('Entregas')
@Controller()
export class DeliveriesController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(DeliveryService) private service: DeliveryService,
  ) {}
  @Get('deliveries') async list(@Req() r: AuthRequest, @Query() q: ListDto) {
    const where: Prisma.DeliveryWhereInput = {
      ...deliveryScope(r.actor),
      ...(q.status
        ? {
            status:
              q.status === 'active' ? { in: [...activeStatuses, 'waiting'] } : (q.status as Stage),
          }
        : {}),
      ...(q.from || q.to
        ? {
            [q.status === 'delivered' ? 'updatedAt' : 'createdAt']: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
      ...(q.q
        ? {
            OR: [
              { recipientName: { contains: q.q, mode: 'insensitive' } },
              { establishment: { name: { contains: q.q, mode: 'insensitive' } } },
              { courier: { name: { contains: q.q, mode: 'insensitive' } } },
              ...(Number.isInteger(Number(q.q.replace('#', '')))
                ? [{ code: Number(q.q.replace('#', '')) }]
                : []),
            ],
          }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.delivery.findMany({
        where,
        take: q.pageSize,
        skip: (q.page - 1) * q.pageSize,
        orderBy: q.status === 'delivered' ? { updatedAt: 'desc' } : { createdAt: 'desc' },
        include: {
          establishment: { select: { id: true, name: true } },
          courier: { select: { id: true, name: true } },
        },
      }),
      this.db.delivery.count({ where }),
    ]);
    return {
      items: items.map((d) => visible(r.actor, d)),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }
  @Get('deliveries/:id') async detail(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const d = await this.db.delivery.findFirst({
      where: { ...deliveryScope(r.actor), id },
      include: {
        establishment: { select: { id: true, name: true } },
        courier: { select: { id: true, name: true, phone: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!d) throw new NotFoundException();
    return visible(r.actor, d);
  }
  @Get('couriers/me/offers') @Roles('courier') async offers(
    @Req() r: AuthRequest,
    @Query() q: ListDto,
  ) {
    const a = r.actor;
    const c = await this.db.courier.findUniqueOrThrow({
      where: { tenantId_id: { tenantId: a.tenantId, id: a.courierId! } },
    });
    if (c.approvalStatus !== 'approved')
      return { items: [], total: 0, page: q.page, pageSize: q.pageSize };
    const where: Prisma.DeliveryWhereInput = {
      tenantId: a.tenantId,
      OR: [
        { status: 'assigned', courierId: c.id },
        ...(c.availabilityStatus === 'available'
          ? [
              {
                status: 'waiting' as const,
                establishment: { operationOpen: true, lifecycleStatus: 'active' },
                offers: { none: { courierId: c.id, status: 'declined' } },
              },
            ]
          : []),
      ],
    };
    const [items, total] = await this.db.$transaction([
      this.db.delivery.findMany({
        where,
        take: q.pageSize,
        skip: (q.page - 1) * q.pageSize,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          code: true,
          status: true,
          version: true,
          courierPayoutCents: true,
          pickupAddress: true,
          pickupReady: true,
          manualDistanceM: true,
          distanceSource: true,
          destinationAddress: true,
          establishment: { select: { name: true } },
        },
      }),
      this.db.delivery.count({ where }),
    ]);
    return {
      items: items.map((d) => ({
        ...d,
        destinationAddress: undefined,
        destinationRegion: {
          city: (d.destinationAddress as Record<string, unknown>).city,
          district: (d.destinationAddress as Record<string, unknown>).district,
        },
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }
  @Post('deliveries') @Roles('admin', 'establishment') create(
    @Req() r: AuthRequest,
    @Body() b: CreateDeliveryDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.create(r.actor, b, key);
  }
  @Post('deliveries/:id/:action') action(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('action') action: string,
    @Body() b: DeliveryActionDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.action(r.actor, id, action, b, key);
  }
}
