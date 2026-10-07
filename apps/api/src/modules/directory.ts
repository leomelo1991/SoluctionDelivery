import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as argon2 from 'argon2';
import { Database } from '../database.js';
import { Roles, type AuthRequest } from '../http/security.js';
import {
  ApprovalDto,
  AvailabilityDto,
  CourierDto,
  EstablishmentDto,
  EstablishmentPatchDto,
  ListDto,
  NoteDto,
  ResetPasswordDto,
  UserActionDto,
  UserDto,
} from '../http/dto.js';
import { atomic, audit, json } from './transactions.js';
import { activeStatuses } from '../domain/deliveries.js';
const page = (q: ListDto) => ({ skip: (q.page - 1) * q.pageSize, take: q.pageSize });
const safeUser = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  mustChangePassword: true,
  establishmentId: true,
  courierId: true,
  createdAt: true,
} as const;
@ApiTags('Cadastros e CRM')
@Controller()
export class DirectoryController {
  constructor(@Inject(Database) private db: Database) {}
  @Get('establishments') @Roles('admin', 'establishment') async establishments(
    @Req() r: AuthRequest,
    @Query() q: ListDto,
  ) {
    const where = {
      tenantId: r.actor.tenantId,
      ...(r.actor.role === 'establishment' ? { id: r.actor.establishmentId ?? '' } : {}),
      ...(q.lifecycleStatus ? { lifecycleStatus: q.lifecycleStatus } : {}),
      ...(q.operationOpen ? { operationOpen: q.operationOpen === 'true' } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: 'insensitive' as const } },
              { city: { contains: q.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.establishment.findMany({ where, ...page(q), orderBy: { createdAt: 'desc' } }),
      this.db.establishment.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
  @Post('establishments') @Roles('admin') async createEstablishment(
    @Req() r: AuthRequest,
    @Body() b: EstablishmentDto,
  ) {
    return atomic(this.db, async (tx) => {
      const e = await tx.establishment.create({
        data: { ...b, address: json(b.address), tenantId: r.actor.tenantId },
      });
      await audit(tx, r.actor, 'establishment', e.id, 'created', { name: e.name });
      return e;
    });
  }
  @Get('establishments/:id') @Roles('admin', 'establishment') async establishment(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (r.actor.role === 'establishment' && id !== r.actor.establishmentId)
      throw new NotFoundException();
    const e = await this.db.establishment.findUnique({
      where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
      include: { notes: { orderBy: { createdAt: 'desc' }, take: 100 } },
    });
    if (!e) throw new NotFoundException();
    return e;
  }
  @Patch('establishments/:id') @Roles('admin', 'establishment') async updateEstablishment(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: EstablishmentPatchDto,
  ) {
    if (
      r.actor.role === 'establishment' &&
      (id !== r.actor.establishmentId ||
        Object.entries(b).some(([k, v]) => v !== undefined && k !== 'operationOpen'))
    )
      throw new ForbiddenException();
    return atomic(this.db, async (tx) => {
      const e = await tx.establishment.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
      });
      if (b.operationOpen === true && (b.lifecycleStatus ?? e.lifecycleStatus) !== 'active')
        throw new BadRequestException({
          code: 'PARTNER_INACTIVE',
          message: 'Ative o parceiro antes de abrir a operação.',
        });
      const { address, ...fields } = b;
      const data = {
        ...fields,
        ...(b.lifecycleStatus && b.lifecycleStatus !== 'active' ? { operationOpen: false } : {}),
        ...(address ? { address: json(address) } : {}),
      };
      const updated = await tx.establishment.update({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
        data,
      });
      await audit(tx, r.actor, 'establishment', id, 'updated', { before: e, after: updated });
      return updated;
    });
  }
  @Post('establishments/:id/notes') @Roles('admin') async note(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: NoteDto,
  ) {
    return atomic(this.db, async (tx) => {
      await tx.establishment.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
      });
      const note = await tx.cRMNote.create({
        data: {
          tenantId: r.actor.tenantId,
          establishmentId: id,
          authorUserId: r.actor.id,
          authorName: r.actor.name,
          text: b.text,
        },
      });
      await audit(tx, r.actor, 'establishment', id, 'note_created', { noteId: note.id });
      return note;
    });
  }
  @Get('couriers') @Roles('admin', 'establishment') async couriers(
    @Req() r: AuthRequest,
    @Query() q: ListDto,
  ) {
    const where = {
      tenantId: r.actor.tenantId,
      ...(r.actor.role === 'establishment'
        ? { approvalStatus: 'approved', availabilityStatus: 'available' }
        : q.approvalStatus
          ? { approvalStatus: q.approvalStatus }
          : {}),
      ...(r.actor.role === 'admin' && q.availabilityStatus
        ? { availabilityStatus: q.availabilityStatus }
        : {}),
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' as const } } : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.courier.findMany({ where, ...page(q), orderBy: { createdAt: 'desc' } }),
      this.db.courier.count({ where }),
    ]);
    return {
      items:
        r.actor.role === 'establishment'
          ? items.map((c) => ({
              id: c.id,
              name: c.name,
              vehicle: c.vehicle,
              availabilityStatus: c.availabilityStatus,
            }))
          : items,
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }
  @Post('couriers') @Roles('admin') async createCourier(
    @Req() r: AuthRequest,
    @Body() b: CourierDto,
  ) {
    return atomic(this.db, async (tx) => {
      const c = await tx.courier.create({ data: { ...b, tenantId: r.actor.tenantId } });
      await audit(tx, r.actor, 'courier', c.id, 'created', { name: c.name });
      return c;
    });
  }
  @Get('couriers/me') @Roles('courier') async myCourier(@Req() r: AuthRequest) {
    return this.db.courier.findUniqueOrThrow({
      where: { tenantId_id: { tenantId: r.actor.tenantId, id: r.actor.courierId! } },
    });
  }
  @Get('couriers/:id') @Roles('admin') async courier(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.db.courier.findUniqueOrThrow({
      where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
      include: {
        deliveries: {
          take: 30,
          orderBy: { createdAt: 'desc' },
          select: { id: true, code: true, status: true, courierPayoutCents: true, createdAt: true },
        },
      },
    });
  }
  @Post('couriers/:id/approval-actions') @Roles('admin') async approve(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: ApprovalDto,
  ) {
    return atomic(this.db, async (tx) => {
      await tx.courier.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
      });
      if (
        b.status === 'paused' &&
        (await tx.delivery.count({
          where: { tenantId: r.actor.tenantId, courierId: id, status: { in: [...activeStatuses] } },
        }))
      )
        throw new BadRequestException({
          code: 'COURIER_BUSY',
          message: 'O entregador tem uma entrega reservada ou ativa.',
        });
      const c = await tx.courier.update({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
        data: {
          approvalStatus: b.status,
          ...(b.status === 'paused' ? { availabilityStatus: 'offline' } : {}),
        },
      });
      await audit(tx, r.actor, 'courier', id, 'approval_changed', { status: b.status });
      return c;
    });
  }
  @Patch('couriers/me/availability') @Roles('courier') async availability(
    @Req() r: AuthRequest,
    @Body() b: AvailabilityDto,
  ) {
    return atomic(this.db, async (tx) => {
      const c = await tx.courier.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id: r.actor.courierId! } },
      });
      if (c.approvalStatus !== 'approved')
        throw new ForbiddenException({
          code: 'APPROVAL_REQUIRED',
          message: 'Seu cadastro precisa estar aprovado.',
        });
      if (
        await tx.delivery.count({
          where: {
            tenantId: r.actor.tenantId,
            courierId: c.id,
            status: { in: [...activeStatuses] },
          },
        })
      )
        throw new BadRequestException({
          code: 'COURIER_BUSY',
          message: 'Conclua a entrega atual antes de alterar sua disponibilidade.',
        });
      const updated = await tx.courier.update({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id: c.id } },
        data: { availabilityStatus: b.status },
      });
      await audit(tx, r.actor, 'courier', c.id, 'availability_changed', { status: b.status });
      return updated;
    });
  }
  @Get('users') @Roles('admin') async users(@Req() r: AuthRequest, @Query() q: ListDto) {
    const where = {
      tenantId: r.actor.tenantId,
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: 'insensitive' as const } },
              { email: { contains: q.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.user.findMany({
        where,
        select: safeUser,
        ...page(q),
        orderBy: { createdAt: 'desc' },
      }),
      this.db.user.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
  @Post('users') @Roles('admin') async user(@Req() r: AuthRequest, @Body() b: UserDto) {
    if (
      (b.role === 'establishment' && !b.establishmentId) ||
      (b.role === 'courier' && !b.courierId) ||
      (b.role !== 'establishment' && b.establishmentId) ||
      (b.role !== 'courier' && b.courierId)
    )
      throw new BadRequestException({
        code: 'INVALID_ROLE_LINK',
        message: 'Vínculo incompatível com o perfil.',
      });
    return atomic(this.db, async (tx) => {
      if (b.establishmentId)
        await tx.establishment.findUniqueOrThrow({
          where: { tenantId_id: { tenantId: r.actor.tenantId, id: b.establishmentId } },
        });
      if (b.courierId) {
        await tx.courier.findUniqueOrThrow({
          where: { tenantId_id: { tenantId: r.actor.tenantId, id: b.courierId } },
        });
        if (await tx.user.count({ where: { tenantId: r.actor.tenantId, courierId: b.courierId } }))
          throw new BadRequestException({
            code: 'COURIER_USER_EXISTS',
            message: 'Este entregador já possui um usuário.',
          });
      }
      const u = await tx.user.create({
        data: {
          tenantId: r.actor.tenantId,
          name: b.name,
          email: b.email.toLowerCase().trim(),
          role: b.role,
          establishmentId: b.establishmentId,
          courierId: b.courierId,
          passwordHash: await argon2.hash(b.temporaryPassword),
        },
        select: safeUser,
      });
      await audit(tx, r.actor, 'user', u.id, 'created', { role: u.role });
      return u;
    });
  }
  @Patch('users/:id') @Roles('admin') async userActive(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: UserActionDto,
  ) {
    if (id === r.actor.id && !b.active)
      throw new BadRequestException({
        code: 'SELF_DISABLE',
        message: 'Você não pode desativar sua própria conta.',
      });
    return atomic(this.db, async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
      });
      if (
        user.courierId &&
        !b.active &&
        (await tx.delivery.count({
          where: {
            tenantId: r.actor.tenantId,
            courierId: user.courierId,
            status: { in: [...activeStatuses] },
          },
        }))
      )
        throw new BadRequestException({
          code: 'COURIER_BUSY',
          message: 'Não desative um entregador com entrega ativa.',
        });
      const u = await tx.user.update({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
        data: { active: b.active },
        select: safeUser,
      });
      if (!b.active) {
        await tx.session.deleteMany({ where: { tenantId: r.actor.tenantId, userId: id } });
        if (user.courierId)
          await tx.courier.update({
            where: { id: user.courierId },
            data: { availabilityStatus: 'offline' },
          });
      }
      await audit(tx, r.actor, 'user', id, 'active_changed', b);
      return u;
    });
  }
  @Post('users/:id/reset-password') @Roles('admin') async reset(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: ResetPasswordDto,
  ) {
    return atomic(this.db, async (tx) => {
      await tx.user.update({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
        data: { passwordHash: await argon2.hash(b.temporaryPassword), mustChangePassword: true },
      });
      await tx.session.deleteMany({ where: { tenantId: r.actor.tenantId, userId: id } });
      await audit(tx, r.actor, 'user', id, 'password_reset', {});
      return { ok: true };
    });
  }
  @Get('audit') @Roles('admin') async audits(@Req() r: AuthRequest, @Query() q: ListDto) {
    const where = { tenantId: r.actor.tenantId };
    const [items, total] = await this.db.$transaction([
      this.db.auditEvent.findMany({ where, ...page(q), orderBy: { createdAt: 'desc' } }),
      this.db.auditEvent.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
}
