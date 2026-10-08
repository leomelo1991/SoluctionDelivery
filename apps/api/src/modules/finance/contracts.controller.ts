import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
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
import { Database } from '../../database.js';
import { Roles, type Actor, type AuthRequest } from '../../http/security.js';
import { ListDto } from '../../http/dto.js';
import { audit, command, json } from '../transactions.js';
import { contractBudget, shiftEnd, type ContractTerms } from '../../domain/finance/contracts.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  AcceptContractDto,
  AllocationDto,
  AttendanceDto,
  CreateContractDto,
  ReasonDto,
  ReviseContractDto,
  RevisionDto,
  ScheduleShiftDto,
  VersionDto,
  ContractTermsDto,
  ReplacementDto,
} from './contracts.dto.js';

function checked<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    throw new BadRequestException((e as Error).message);
  }
}
function instant(value: string) {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new BadRequestException('Informe data/hora com fuso explícito.');
  return new Date(value);
}
function dates(b: VersionDto) {
  const effectiveFrom = instant(b.effectiveFrom),
    effectiveTo = instant(b.effectiveTo);
  if (
    effectiveTo <= effectiveFrom ||
    effectiveTo.getTime() - effectiveFrom.getTime() > 366 * 86400000
  )
    throw new BadRequestException('Informe vigência positiva de até um ano.');
  checked(() => contractBudget(b.terms));
  return { effectiveFrom, effectiveTo, terms: json(b.terms) };
}
function scope(a: Actor) {
  return {
    tenantId: a.tenantId,
    ...(a.role === 'establishment' ? { establishmentId: a.establishmentId! } : {}),
  };
}
function viewVersion<T extends { terms: Prisma.JsonValue }>(v: T, a: Actor) {
  const terms = v.terms as unknown as ContractTerms;
  const budget = contractBudget(terms);
  if (a.role === 'admin') return { ...v, budget };
  const {
    payModel: _model,
    courierFixedCents: _fixed,
    courierDeliveryCents: _variable,
    ...publicTerms
  } = terms;
  return {
    ...v,
    terms: publicTerms,
    budget: {
      deliveries: budget.deliveries,
      courierMinutes: budget.courierMinutes,
      merchantCents: budget.merchantCents,
    },
  };
}
const requireRevision = (
  v: { revision: number; status: string },
  revision: number,
  status: string,
) => {
  if (v.revision !== revision || v.status !== status)
    throw new ConflictException('A versão mudou ou não permite esta ação. Atualize a página.');
};
@ApiTags('Contratos e escalas')
@Controller()
@Roles('admin', 'establishment')
export class ContractsController {
  constructor(@Inject(Database) private db: Database) {}

  @Get('contracts') async list(@Req() r: AuthRequest, @Query() q: ListDto) {
    const where = {
      ...scope(r.actor),
      ...(q.q ? { title: { contains: q.q, mode: 'insensitive' as const } } : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.merchantContract.findMany({
        where,
        include: {
          establishment: { select: { id: true, name: true } },
          versions: {
            where: r.actor.role === 'admin' ? {} : { status: { in: ['proposed', 'accepted'] } },
            orderBy: { number: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.db.merchantContract.count({ where }),
    ]);
    return {
      items: items.map((c) => ({ ...c, versions: c.versions.map((v) => viewVersion(v, r.actor)) })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }
  @Post('contracts/simulate') @Roles('admin') simulate(@Body() b: ContractTermsDto) {
    return checked(() => contractBudget(b));
  }
  @Post('contracts') @Roles('admin') create(
    @Req() r: AuthRequest,
    @Body() b: CreateContractDto,
    @Headers('idempotency-key') key?: string,
  ) {
    const data = dates(b);
    return command(this.db, r.actor, key, 'contract.create', b, async (tx) => {
      await tx.establishment.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id: b.establishmentId } },
      });
      const c = await tx.merchantContract.create({
        data: {
          tenantId: r.actor.tenantId,
          establishmentId: b.establishmentId,
          title: b.title.trim(),
        },
      });
      const version = await tx.contractVersion.create({
        data: { ...data, tenantId: r.actor.tenantId, contractId: c.id, number: 1 },
      });
      await audit(tx, r.actor, 'contract', c.id, 'draft_created', { versionId: version.id });
      return { ...c, version };
    });
  }
  @Post('contracts/:id/versions') @Roles('admin') newVersion(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: VersionDto,
    @Headers('idempotency-key') key?: string,
  ) {
    const data = dates(b);
    return command(this.db, r.actor, key, 'contract.version', { id, ...b }, async (tx) => {
      await tx.merchantContract.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
      });
      const last = await tx.contractVersion.findFirstOrThrow({
        where: { tenantId: r.actor.tenantId, contractId: id },
        orderBy: { number: 'desc' },
      });
      const version = await tx.contractVersion.create({
        data: { ...data, tenantId: r.actor.tenantId, contractId: id, number: last.number + 1 },
      });
      await audit(tx, r.actor, 'contract', id, 'version_created', {
        versionId: version.id,
        number: version.number,
      });
      return version;
    });
  }
  @Patch('contract-versions/:id') @Roles('admin') revise(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: ReviseContractDto,
    @Headers('idempotency-key') key?: string,
  ) {
    const data = dates(b);
    return command(this.db, r.actor, key, 'contract.revise', { id, ...b }, async (tx) => {
      const v = await tx.contractVersion.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
      });
      requireRevision(v, b.revision, 'draft');
      const updated = await tx.contractVersion.update({
        where: { id },
        data: { ...data, revision: { increment: 1 } },
      });
      await audit(tx, r.actor, 'contract', v.contractId, 'draft_revised', {
        before: v,
        after: updated,
      });
      return updated;
    });
  }
  @Post('contract-versions/:id/propose') @Roles('admin') propose(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: RevisionDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return command(this.db, r.actor, key, 'contract.propose', { id, ...b }, async (tx) => {
      const v = await tx.contractVersion.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
      });
      requireRevision(v, b.revision, 'draft');
      if (v.effectiveTo <= new Date()) throw new BadRequestException('A vigência já terminou.');
      const updated = await tx.contractVersion.update({
        where: { id },
        data: { status: 'proposed', proposedAt: new Date(), revision: { increment: 1 } },
      });
      await audit(tx, r.actor, 'contract', v.contractId, 'proposed', { versionId: id });
      return updated;
    });
  }
  @Post('contract-versions/:id/accept') accept(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: AcceptContractDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return command(this.db, r.actor, key, 'contract.accept', { id, ...b }, async (tx) => {
      const v = await tx.contractVersion.findFirst({
        where: { id, tenantId: r.actor.tenantId, contract: scope(r.actor) },
        include: { contract: true },
      });
      if (!v) throw new NotFoundException();
      requireRevision(v, b.revision, 'proposed');
      if (v.effectiveTo <= new Date()) throw new BadRequestException('A vigência já terminou.');
      const overlap = await tx.contractVersion.count({
        where: {
          tenantId: r.actor.tenantId,
          status: 'accepted',
          contract: { establishmentId: v.contract.establishmentId },
          effectiveFrom: { lt: v.effectiveTo },
          effectiveTo: { gt: v.effectiveFrom },
        },
      });
      if (overlap)
        throw new ConflictException(
          'Já existe contrato aceito para esta loja nessa vigência. Crie uma versão com período posterior.',
        );
      const updated = await tx.contractVersion.update({
        where: { id },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
          acceptedBy: r.actor.id,
          acceptanceEvidence: b.evidence.trim(),
          revision: { increment: 1 },
        },
      });
      await audit(
        tx,
        r.actor,
        'contract',
        v.contractId,
        'accepted',
        { versionId: id, role: r.actor.role },
        b.evidence,
      );
      return viewVersion(updated, r.actor);
    });
  }
  @Get('contract-shifts') async shifts(@Req() r: AuthRequest, @Query() q: ListDto) {
    const where = {
      tenantId: r.actor.tenantId,
      version: { contract: scope(r.actor) },
      ...(q.from || q.to
        ? {
            startsAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lt: new Date(q.to) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.scheduledShift.findMany({
        where,
        include: {
          version: {
            include: {
              contract: { include: { establishment: { select: { id: true, name: true } } } },
            },
          },
          allocations: {
            include: {
              courier: { select: { id: true, name: true } },
              attendance: { orderBy: { createdAt: 'desc' } },
            },
            orderBy: [{ position: 'asc' }, { startsAt: 'asc' }],
          },
        },
        orderBy: { startsAt: 'desc' },
        take: q.pageSize,
        skip: (q.page - 1) * q.pageSize,
      }),
      this.db.scheduledShift.count({ where }),
    ]);
    return {
      items: items.map((s) => ({ ...s, version: viewVersion(s.version, r.actor) })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }
  @Post('contract-shifts') @Roles('admin') schedule(
    @Req() r: AuthRequest,
    @Body() b: ScheduleShiftDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return command(this.db, r.actor, key, 'shift.schedule', b, async (tx) => {
      const v = await tx.contractVersion.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id: b.versionId } },
      });
      if (v.status !== 'accepted')
        throw new ConflictException('Aceite o contrato antes de criar a escala.');
      const terms = v.terms as unknown as ContractTerms;
      const template = terms.templates[b.templateIndex];
      if (!template) throw new BadRequestException('Turno inválido.');
      const startsAt = instant(b.startsAt),
        endsAt = checked(() => shiftEnd(startsAt, template, terms.timezone));
      if (startsAt < v.effectiveFrom || endsAt > v.effectiveTo || startsAt < new Date())
        throw new BadRequestException('Agende um turno futuro dentro da vigência aceita.');
      const s = await tx.scheduledShift.create({
        data: {
          tenantId: r.actor.tenantId,
          versionId: v.id,
          templateIndex: b.templateIndex,
          startsAt,
          endsAt,
          capacity: template.courierCount,
        },
      });
      await audit(tx, r.actor, 'contract_shift', s.id, 'scheduled', s);
      return s;
    });
  }
  @Post('contract-shifts/:id/allocate') @Roles('admin') allocate(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: AllocationDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return command(this.db, r.actor, key, 'shift.allocate', { id, ...b }, async (tx) => {
      const s = await tx.scheduledShift.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
      });
      const startsAt = instant(b.startsAt),
        endsAt = instant(b.endsAt);
      if (
        s.status !== 'scheduled' ||
        b.position > s.capacity ||
        startsAt < s.startsAt ||
        endsAt > s.endsAt ||
        endsAt <= startsAt ||
        startsAt < new Date()
      )
        throw new BadRequestException(
          'Vaga ou intervalo indisponível. Use um período futuro dentro do turno.',
        );
      const courier = await tx.courier.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id: b.courierId } },
      });
      if (courier.approvalStatus !== 'approved')
        throw new BadRequestException('Entregador precisa estar aprovado.');
      const overlaps = await tx.courierAllocation.count({
        where: {
          tenantId: r.actor.tenantId,
          cancelledAt: null,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
          OR: [{ courierId: b.courierId }, { shiftId: id, position: b.position }],
        },
      });
      if (overlaps) throw new ConflictException('Entregador ou vaga já reservado nesse horário.');
      const allocation = await tx.courierAllocation.create({
        data: {
          tenantId: r.actor.tenantId,
          shiftId: id,
          courierId: b.courierId,
          position: b.position,
          startsAt,
          endsAt,
        },
      });
      await audit(tx, r.actor, 'courier_allocation', allocation.id, 'allocated', allocation);
      return allocation;
    });
  }
  @Post('contract-allocations/:id/replace') @Roles('admin') replace(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: ReplacementDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return command(this.db, r.actor, key, 'allocation.replace', { id, ...b }, async (tx) => {
      const old = await tx.courierAllocation.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
        include: { shift: true },
      });
      const now = new Date();
      if (
        old.cancelledAt ||
        old.endsAt <= now ||
        old.shift.status !== 'scheduled' ||
        old.courierId === b.courierId
      )
        throw new ConflictException('Escolha outro entregador para uma alocação ainda ativa.');
      const replacement = await tx.courier.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id: b.courierId } },
      });
      if (replacement.approvalStatus !== 'approved')
        throw new BadRequestException('O substituto precisa estar aprovado.');
      const startsAt = old.startsAt > now ? old.startsAt : now;
      if (
        await tx.courierAllocation.count({
          where: {
            tenantId: r.actor.tenantId,
            courierId: b.courierId,
            cancelledAt: null,
            startsAt: { lt: old.endsAt },
            endsAt: { gt: startsAt },
          },
        })
      )
        throw new ConflictException('O substituto já possui reserva nesse intervalo.');
      await tx.courierAllocation.update({
        where: { id },
        data:
          old.startsAt >= now
            ? { cancelledAt: now, cancellationReason: b.reason }
            : { endsAt: now },
      });
      const created = await tx.courierAllocation.create({
        data: {
          tenantId: old.tenantId,
          shiftId: old.shiftId,
          position: old.position,
          courierId: b.courierId,
          startsAt,
          endsAt: old.endsAt,
        },
      });
      await audit(
        tx,
        r.actor,
        'courier_allocation',
        id,
        'replaced',
        {
          previousStartsAt: old.startsAt,
          previousEndsAt: old.endsAt,
          replacementId: created.id,
          replacedAt: startsAt,
        },
        b.reason,
      );
      return created;
    });
  }
  @Post('contract-allocations/:id/cancel') @Roles('admin') cancelAllocation(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: ReasonDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return command(this.db, r.actor, key, 'allocation.cancel', { id, ...b }, async (tx) => {
      const a = await tx.courierAllocation.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
      });
      if (a.cancelledAt || a.startsAt <= new Date())
        throw new ConflictException('Só é possível liberar uma alocação futura e ativa.');
      const result = await tx.courierAllocation.update({
        where: { id },
        data: { cancelledAt: new Date(), cancellationReason: b.reason },
      });
      await audit(tx, r.actor, 'courier_allocation', id, 'cancelled', {}, b.reason);
      return result;
    });
  }
  @Post('contract-shifts/:id/cancel') @Roles('admin') cancelShift(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: ReasonDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return command(this.db, r.actor, key, 'shift.cancel', { id, ...b }, async (tx) => {
      const s = await tx.scheduledShift.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
      });
      if (s.status !== 'scheduled' || s.startsAt <= new Date())
        throw new ConflictException('Só é possível cancelar um turno futuro.');
      await tx.courierAllocation.updateMany({
        where: { tenantId: r.actor.tenantId, shiftId: id, cancelledAt: null },
        data: { cancelledAt: new Date(), cancellationReason: b.reason },
      });
      const result = await tx.scheduledShift.update({
        where: { id },
        data: { status: 'cancelled' },
      });
      await audit(tx, r.actor, 'contract_shift', id, 'cancelled', {}, b.reason);
      return result;
    });
  }
  @Post('contract-allocations/:id/attendance') @Roles('admin') attendance(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: AttendanceDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return command(this.db, r.actor, key, 'allocation.attendance', { id, ...b }, async (tx) => {
      const a = await tx.courierAllocation.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
      });
      const settled = await tx.financeSettlement.findFirst({
        where: {
          tenantId: r.actor.tenantId,
          version: { shifts: { some: { allocations: { some: { id } } } } },
          weekStart: { lte: a.startsAt, gt: new Date(a.startsAt.getTime() - 7 * 86400000) },
        },
      });
      if (settled) throw new ConflictException('Presença já apurada em demonstrativo fechado.');
      if (
        a.cancelledAt ||
        a.endsAt > new Date() ||
        b.attendedMinutes > (a.endsAt.getTime() - a.startsAt.getTime()) / 60000
      )
        throw new BadRequestException(
          'Registre presença após o intervalo, até o total de minutos alocados.',
        );
      const e = await tx.attendanceEvent.create({
        data: {
          tenantId: r.actor.tenantId,
          allocationId: id,
          actorUserId: r.actor.id,
          attendedMinutes: b.attendedMinutes,
          reason: b.reason,
        },
      });
      await audit(
        tx,
        r.actor,
        'courier_allocation',
        id,
        'attendance_recorded',
        { minutes: b.attendedMinutes },
        b.reason,
      );
      return e;
    });
  }
}
