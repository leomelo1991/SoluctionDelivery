import { Prisma } from '../generated/prisma/client.js';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  NotFoundException,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, Length, Matches } from 'class-validator';
import { Database } from '../database.js';
import { RateLimiter, Roles, type AuthRequest } from '../http/security.js';
import { ListDto } from '../http/dto.js';
import { atomic, audit, json } from './transactions.js';
export class SimulateOrderDto {
  @ApiProperty() @IsUUID() establishmentId!: string;
  @ApiProperty({ enum: ['ifood', '99food', 'other'] })
  @IsIn(['ifood', '99food', 'other'])
  provider!: string;
  @ApiProperty() @IsString() @Length(1, 80) @Matches(/^[A-Za-z0-9_-]+$/) externalReference!: string;
}
@ApiTags('Pedidos externos — demonstração')
@Controller('external-orders')
@Roles('admin', 'establishment')
export class ExternalOrdersController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(RateLimiter) private limiter: RateLimiter,
  ) {}
  private scope(r: AuthRequest) {
    if (r.actor.role === 'establishment' && !r.actor.establishmentId)
      throw new ForbiddenException();
    return {
      tenantId: r.actor.tenantId,
      ...(r.actor.role === 'establishment' ? { establishmentId: r.actor.establishmentId! } : {}),
    };
  }
  @Get() @Header('Cache-Control', 'no-store') async list(
    @Req() r: AuthRequest,
    @Query() q: ListDto,
  ) {
    const where = this.scope(r);
    const [items, total] = await this.db.$transaction([
      this.db.externalOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: q.pageSize,
        skip: (q.page - 1) * q.pageSize,
        include: {
          establishment: { select: { name: true } },
          delivery: { select: { id: true, code: true, status: true } },
        },
      }),
      this.db.externalOrder.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
  @Post('simulate') async simulate(@Req() r: AuthRequest, @Body() b: SimulateOrderDto) {
    this.scope(r);
    if (r.actor.role === 'establishment' && b.establishmentId !== r.actor.establishmentId)
      throw new ForbiddenException();
    await this.limiter.hit(`external-order-demo:${r.actor.tenantId}:${r.actor.id}`, 20);
    return atomic(this.db, async (tx) => {
      const store = await tx.establishment.findFirst({
        where: { id: b.establishmentId, tenantId: r.actor.tenantId },
      });
      if (!store) throw new NotFoundException();
      const identity = {
        tenantId: r.actor.tenantId,
        establishmentId: store.id,
        provider: b.provider,
        externalReference: b.externalReference,
      };
      const existing = await tx.externalOrder.findUnique({
        where: { tenantId_establishmentId_provider_externalReference: identity },
      });
      if (existing) return existing;
      const order = await tx.externalOrder.create({
        data: {
          ...identity,
          mode: 'demo',
          recipientName: 'Cliente demonstrativo',
          recipientPhone: '16000000000',
          destinationAddress: json(store.address),
          notes:
            'Pedido simulado para apresentação. Revise o endereço antes de criar a entrega; não recebido de uma plataforma real.',
        },
      });
      await audit(tx, r.actor, 'external-order', order.id, 'simulated', {
        provider: b.provider,
        reference: b.externalReference,
        mode: 'demo',
      });
      return order;
    }).catch(async (error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.db.externalOrder.findUnique({
          where: {
            tenantId_establishmentId_provider_externalReference: {
              tenantId: r.actor.tenantId,
              establishmentId: b.establishmentId,
              provider: b.provider,
              externalReference: b.externalReference,
            },
          },
        });
        if (existing) return existing;
      }
      throw error;
    });
  }
}
