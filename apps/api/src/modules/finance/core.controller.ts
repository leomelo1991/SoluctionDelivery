import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Database } from '../../database.js';
import { Roles, type AuthRequest, type Actor } from '../../http/security.js';
import { audit, command, json } from '../transactions.js';
import {
  account,
  amount,
  balance,
  canManage,
  financialCommand,
  post,
  wallet,
  type Tx,
} from './ledger.js';
import { FinanceWorker } from './worker.js';
import {
  FinanceReasonDto,
  WalletDto,
  PermissionDto,
  FinanceQuery,
  TopupDto,
  WeekReservationDto,
  DeliveryReservationDto,
  CloseReservationDto,
} from './core.dto.js';
import { financeWeek } from '../../domain/finance/money.js';
import type { ContractTerms } from '../../domain/finance/contracts.js';

function storeId(a: Actor, q: FinanceQuery) {
  if (a.role === 'establishment') {
    if (!a.establishmentId || (q.establishmentId && q.establishmentId !== a.establishmentId))
      throw new ForbiddenException();
    return a.establishmentId;
  }
  if (!q.establishmentId) throw new BadRequestException('Selecione um estabelecimento.');
  return q.establishmentId;
}
function week(value: string) {
  try {
    return financeWeek(value);
  } catch (e) {
    throw new BadRequestException((e as Error).message);
  }
}
@ApiTags('Financeiro de simulação')
@Controller('finance')
@Roles('admin', 'establishment')
export class FinanceController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(FinanceWorker) private worker: FinanceWorker,
  ) {}
  @Header('Cache-Control', 'no-store') @Get('status') async status(@Req() r: AuthRequest) {
    return {
      enabled: !!(await this.db.financeWorkspace.findUnique({
        where: { tenantId: r.actor.tenantId },
      })),
      mode: 'sandbox',
      canManage: await canManage(this.db, r.actor),
    };
  }
  @Post('enable') @Roles('admin') enable(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') key: string,
    @Body() b: FinanceReasonDto,
  ) {
    return command(this.db, r.actor, key, 'finance.enable', b, async (tx) => {
      const existing = await tx.financeWorkspace.findUnique({
        where: { tenantId: r.actor.tenantId },
      });
      if (existing)
        throw new ConflictException(
          'A simulação já está habilitada. Solicite acesso ao gestor financeiro.',
        );
      await tx.financeWorkspace.create({ data: { tenantId: r.actor.tenantId } });
      await tx.financePermission.create({
        data: { tenantId: r.actor.tenantId, userId: r.actor.id },
      });
      await audit(tx, r.actor, 'finance', r.actor.tenantId, 'sandbox_enabled', {}, b.reason);
      return { enabled: true, mode: 'sandbox' };
    });
  }
  @Post('permissions') @Roles('admin') permission(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') key: string,
    @Body() b: PermissionDto,
  ) {
    return financialCommand(this.db, r.actor, key, 'permission', b, async (tx) => {
      const user = await tx.user.findFirst({
        where: { tenantId: r.actor.tenantId, id: b.userId, role: 'admin', active: true },
      });
      if (!user) throw new NotFoundException('Administrador ativo não encontrado.');
      if (!b.enabled && b.userId === r.actor.id)
        throw new BadRequestException('Outro gestor deve revisar a remoção da sua permissão.');
      if (b.enabled)
        await tx.financePermission.createMany({
          data: [{ tenantId: r.actor.tenantId, userId: b.userId }],
          skipDuplicates: true,
        });
      else
        await tx.financePermission.deleteMany({
          where: { tenantId: r.actor.tenantId, userId: b.userId },
        });
      return { userId: b.userId, enabled: b.enabled };
    });
  }
  @Post('wallets/:id') @Roles('admin') configure(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string,
    @Body() b: WalletDto,
  ) {
    return financialCommand(this.db, r.actor, key, 'wallet.configure', { id, ...b }, async (tx) => {
      const store = await tx.establishment.findFirst({ where: { id, tenantId: r.actor.tenantId } });
      if (!store) throw new NotFoundException();
      const w = await tx.financeWallet.upsert({
        where: { tenantId_establishmentId: { tenantId: r.actor.tenantId, establishmentId: id } },
        create: { tenantId: r.actor.tenantId, establishmentId: id, enabled: b.enabled },
        update: { enabled: b.enabled },
      });
      await account(tx, r.actor.tenantId, 'available', id);
      await account(tx, r.actor.tenantId, 'reserved', id);
      return w;
    });
  }
  @Header('Cache-Control', 'no-store') @Get('wallet') async summary(
    @Req() r: AuthRequest,
    @Query() q: FinanceQuery,
  ) {
    const id = storeId(r.actor, q),
      tenantId = r.actor.tenantId;
    return this.db.$transaction(
      async (tx) => {
        const store = await tx.establishment.findFirst({
          where: { id, tenantId },
          select: { id: true, name: true },
        });
        if (!store) throw new NotFoundException();
        const w = await tx.financeWallet.findUnique({
          where: { tenantId_establishmentId: { tenantId, establishmentId: id } },
        });
        return {
          mode: 'sandbox',
          establishment: store,
          configured: !!w,
          enabled: w?.enabled ?? false,
          availableCents: (await balance(tx, tenantId, id, 'available')).toString(),
          reservedCents: (await balance(tx, tenantId, id, 'reserved')).toString(),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  @Header('Cache-Control', 'no-store') @Get('statement') async statement(
    @Req() r: AuthRequest,
    @Query() q: FinanceQuery,
  ) {
    const id = storeId(r.actor, q),
      tenantId = r.actor.tenantId;
    const items = await this.db.ledgerTransaction.findMany({
      where: {
        tenantId,
        status: 'posted',
        entries: { some: { account: { code: { in: [`available:${id}`, `reserved:${id}`] } } } },
      },
      include: {
        entries: {
          where: { account: { code: { in: [`available:${id}`, `reserved:${id}`] } } },
          include: { account: { select: { kind: true } } },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    return {
      items: items.slice(0, 50).map((t) => ({
        id: t.id,
        createdAt: t.createdAt,
        description: t.description,
        source: t.source,
        availableDeltaCents: (-t.entries
          .filter((e) => e.account.kind === 'available')
          .reduce((s, e) => s + e.amount, 0n)).toString(),
        reservedDeltaCents: (-t.entries
          .filter((e) => e.account.kind === 'reserved')
          .reduce((s, e) => s + e.amount, 0n)).toString(),
      })),
      nextCursor: items.length > 50 ? items[49].id : null,
    };
  }
  @Header('Cache-Control', 'no-store') @Get('reservations') async reservations(
    @Req() r: AuthRequest,
    @Query() q: FinanceQuery,
  ) {
    const id = storeId(r.actor, q);
    const rows = await this.db.financeReservation.findMany({
      where: { tenantId: r.actor.tenantId, establishmentId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    // O snapshot interno de tarifa não é divulgado à loja.
    return {
      items: rows.slice(0, 50).map((v) => ({
        id: v.id,
        kind: v.kind,
        source: v.source,
        amountCents: v.amount.toString(),
        consumedCents: v.consumed.toString(),
        status: v.status,
        createdAt: v.createdAt,
        closedAt: v.closedAt,
      })),
      nextCursor: rows.length > 50 ? rows[49].id : null,
    };
  }
  @Header('Cache-Control', 'no-store') @Get('topups') async topups(
    @Req() r: AuthRequest,
    @Query() q: FinanceQuery,
  ) {
    const id = storeId(r.actor, q);
    const rows = await this.db.financeTopup.findMany({
      where: { tenantId: r.actor.tenantId, establishmentId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    return {
      items: rows.slice(0, 50).map((t) => ({
        id: t.id,
        reference: t.reference,
        amountCents: t.amount.toString(),
        status: t.status,
        createdAt: t.createdAt,
      })),
      nextCursor: rows.length > 50 ? rows[49].id : null,
    };
  }
  @Post('topups') @Roles('admin') topup(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') key: string,
    @Body() b: TopupDto,
  ) {
    // Referência de negócio é independente da chave HTTP e do usuário.
    return financialCommand(this.db, r.actor, key, 'topup', b, async (tx) => {
      await wallet(tx, r.actor.tenantId, b.establishmentId);
      const old = await tx.financeTopup.findUnique({
        where: { tenantId_reference: { tenantId: r.actor.tenantId, reference: b.reference } },
      });
      const value = amount(b.amountCents);
      if (old) {
        if (
          old.amount !== value ||
          old.establishmentId !== b.establishmentId ||
          old.scenario !== b.scenario
        )
          throw new ConflictException('Referência de crédito já usada com outros dados.');
        return old;
      }
      const created = await tx.financeTopup.create({
        data: {
          tenantId: r.actor.tenantId,
          establishmentId: b.establishmentId,
          reference: b.reference,
          amount: value,
          scenario: b.scenario,
          actorId: r.actor.id,
        },
      });
      await tx.financeTask.create({ data: { tenantId: r.actor.tenantId, topupId: created.id } });
      return created;
    });
  }
  @Post('process') @Roles('admin') async process(@Req() r: AuthRequest) {
    if (!(await canManage(this.db, r.actor))) throw new ForbiddenException();
    return this.worker.run(r.actor.tenantId);
  }
  private async reserve(
    tx: Tx,
    a: Actor,
    data: {
      establishmentId: string;
      source: string;
      kind: 'week' | 'delivery';
      amount: bigint;
      versionId?: string;
      deliveryId?: string;
      weekStart?: Date;
      snapshot: unknown;
    },
  ) {
    await wallet(tx, a.tenantId, data.establishmentId);
    const old = await tx.financeReservation.findUnique({
      where: { tenantId_source: { tenantId: a.tenantId, source: data.source } },
    });
    if (old) return old;
    if (data.amount <= 0n)
      throw new BadRequestException('O componente não possui valor a reservar.');
    if ((await balance(tx, a.tenantId, data.establishmentId, 'available')) < data.amount)
      throw new ConflictException('Saldo disponível insuficiente para este compromisso.');
    const v = await tx.financeReservation.create({
      data: { ...data, tenantId: a.tenantId, snapshot: json(data.snapshot) },
    });
    const available = await account(tx, a.tenantId, 'available', data.establishmentId),
      reserved = await account(tx, a.tenantId, 'reserved', data.establishmentId);
    await post(
      tx,
      a.tenantId,
      a.id,
      `reserve:${v.id}`,
      data.kind === 'week'
        ? 'Reserva do mínimo semanal (simulação)'
        : 'Reserva de entrega (simulação)',
      available.id,
      reserved.id,
      data.amount,
    );
    return v;
  }
  @Post('reservations/week') @Roles('admin') reserveWeek(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') key: string,
    @Body() b: WeekReservationDto,
  ) {
    return financialCommand(this.db, r.actor, key, 'reserve.week', b, async (tx) => {
      const v = await tx.contractVersion.findFirst({
        where: { id: b.versionId, tenantId: r.actor.tenantId, status: 'accepted' },
        include: { contract: true },
      });
      if (!v) throw new NotFoundException('Versão aceita não encontrada.');
      const { start, end } = week(b.week);
      if (start < v.effectiveFrom || end > v.effectiveTo)
        throw new BadRequestException(
          'Esta etapa exige uma semana completa dentro da vigência do contrato.',
        );
      const terms = v.terms as unknown as ContractTerms;
      return this.reserve(tx, r.actor, {
        establishmentId: v.contract.establishmentId,
        source: `week:${v.id}:${b.week}`,
        kind: 'week',
        amount: BigInt(terms.weeklyAvailabilityCents) + BigInt(terms.platformFeeCents),
        versionId: v.id,
        weekStart: start,
        snapshot: { terms, weekEnd: end },
      });
    });
  }
  @Post('reservations/delivery') @Roles('admin') reserveDelivery(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') key: string,
    @Body() b: DeliveryReservationDto,
  ) {
    return financialCommand(this.db, r.actor, key, 'reserve.delivery', b, async (tx) => {
      const d = await tx.delivery.findFirst({
        where: { id: b.deliveryId, tenantId: r.actor.tenantId },
      });
      if (!d) throw new NotFoundException();
      const old = await tx.financeReservation.findUnique({
        where: { tenantId_source: { tenantId: r.actor.tenantId, source: `delivery:${d.id}` } },
      });
      if (old) return old;
      if (d.status === 'delivered')
        throw new ConflictException('Entregas concluídas não podem originar novas reservas.');
      const v = await tx.contractVersion.findFirst({
        where: {
          tenantId: r.actor.tenantId,
          status: 'accepted',
          effectiveFrom: { lte: d.createdAt },
          effectiveTo: { gt: d.createdAt },
          contract: { establishmentId: d.establishmentId },
        },
      });
      // Contrato dedicado cobra somente variável: nunca soma tarifa operacional + mínimo de novo.
      const terms = v?.terms as unknown as ContractTerms | undefined;
      const value = terms ? terms.deliveryFeeCents : d.feeCents;
      return this.reserve(tx, r.actor, {
        establishmentId: d.establishmentId,
        source: `delivery:${d.id}`,
        kind: 'delivery',
        amount: BigInt(value),
        versionId: v?.id,
        deliveryId: d.id,
        snapshot: {
          deliveryVersion: d.version,
          deliveryCreatedAt: d.createdAt,
          feeCents: value,
          policy: terms ? 'contract_variable' : 'operational_fee',
        },
      });
    });
  }
  @Post('reservations/:id/close') @Roles('admin') close(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string,
    @Body() b: CloseReservationDto,
  ) {
    return financialCommand(this.db, r.actor, key, 'reserve.close', { id, ...b }, async (tx) => {
      const v = await tx.financeReservation.findUnique({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
      });
      if (!v) throw new NotFoundException();
      const consumed = amount(b.consumedCents, true);
      if (v.status === 'closed') {
        if (v.consumed !== consumed)
          throw new ConflictException('Reserva já encerrada com outro valor.');
        return v;
      }
      if (consumed > v.amount) throw new BadRequestException('Consumo não pode exceder a reserva.');
      // Pausa bloqueia novos compromissos, não impede liberar/encerrar os já existentes.
      const reserved = await account(tx, r.actor.tenantId, 'reserved', v.establishmentId);
      if (consumed > 0n) {
        const revenue = await account(tx, r.actor.tenantId, 'revenue');
        await post(
          tx,
          r.actor.tenantId,
          r.actor.id,
          `consume:${v.id}`,
          'Consumo simulado da reserva',
          reserved.id,
          revenue.id,
          consumed,
        );
      }
      if (v.amount > consumed) {
        const available = await account(tx, r.actor.tenantId, 'available', v.establishmentId);
        await post(
          tx,
          r.actor.tenantId,
          r.actor.id,
          `release:${v.id}`,
          'Liberação do valor não consumido (simulação)',
          reserved.id,
          available.id,
          v.amount - consumed,
        );
      }
      return tx.financeReservation.update({
        where: { id: v.id },
        data: { status: 'closed', consumed, closedAt: new Date() },
      });
    });
  }
}
