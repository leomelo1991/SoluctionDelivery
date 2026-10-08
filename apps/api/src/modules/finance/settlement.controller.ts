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
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsUUID, ValidateIf } from 'class-validator';
import { Database } from '../../database.js';
import { Roles, type AuthRequest } from '../../http/security.js';
import { FinanceQuery, FinanceReasonDto, WeekReservationDto } from './core.dto.js';
import { account, financialCommand, post } from './ledger.js';
import { settleWeek } from './settlement.service.js';
class PayoutDto extends FinanceReasonDto {
  @ApiProperty() @IsUUID() earningId!: string;
  @ApiProperty({ enum: ['approve', 'decline', 'timeout_after_accept'] })
  @IsIn(['approve', 'decline', 'timeout_after_accept'])
  scenario!: string;
}
class EarningsQuery {
  @ApiPropertyOptional() @ValidateIf((_o, v) => v !== undefined) @IsUUID() courierId?: string;
  @ApiPropertyOptional() @ValidateIf((_o, v) => v !== undefined) @IsUUID() cursor?: string;
}
@ApiTags('Fechamento e repasses de simulação')
@Controller('finance')
@Roles('admin', 'establishment', 'courier')
export class SettlementController {
  constructor(@Inject(Database) private db: Database) {}
  @Post('settlements') @Roles('admin') close(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') key: string,
    @Body() b: WeekReservationDto,
  ) {
    return financialCommand(this.db, r.actor, key, 'settlement.close', b, (tx) =>
      settleWeek(tx, r.actor, b.versionId, b.week),
    );
  }
  @Get('settlements')
  @Header('Cache-Control', 'no-store')
  @Roles('admin', 'establishment')
  async list(@Req() r: AuthRequest, @Query() q: FinanceQuery) {
    const establishmentId =
      r.actor.role === 'establishment' ? r.actor.establishmentId : q.establishmentId;
    if (!establishmentId) throw new BadRequestException('Selecione um estabelecimento.');
    if (
      r.actor.role === 'establishment' &&
      q.establishmentId &&
      q.establishmentId !== establishmentId
    )
      throw new ForbiddenException();
    const rows = await this.db.financeSettlement.findMany({
      where: { tenantId: r.actor.tenantId, establishmentId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    return {
      items: rows.slice(0, 50).map((s) => {
        const snapshot = s.snapshot as Record<string, unknown>;
        return {
          id: s.id,
          versionId: s.versionId,
          weekStart: s.weekStart,
          createdAt: s.createdAt,
          totalCents: s.total.toString(),
          availabilityCents: snapshot.availability,
          platformCents: snapshot.platform,
          variableCents: snapshot.variable,
          releasedCents: snapshot.released,
          plannedMinutes: snapshot.plannedMinutes,
          attendedMinutes: snapshot.attendedMinutes,
        };
      }),
      nextCursor: rows.length > 50 ? rows[49].id : null,
    };
  }
  @Get('earnings') @Header('Cache-Control', 'no-store') @Roles('admin', 'courier') async earnings(
    @Req() r: AuthRequest,
    @Query() q: EarningsQuery,
  ) {
    const courierId = r.actor.role === 'courier' ? r.actor.courierId : q.courierId;
    if (r.actor.role === 'courier' && (!courierId || (q.courierId && q.courierId !== courierId)))
      throw new ForbiddenException();
    const rows = await this.db.financeEarning.findMany({
      where: { tenantId: r.actor.tenantId, ...(courierId ? { courierId } : {}) },
      include: {
        courier: { select: { name: true } },
        payouts: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    return {
      items: rows.slice(0, 50).map((e) => ({
        id: e.id,
        courierId: e.courierId,
        courierName: e.courier.name,
        amountCents: e.amount.toString(),
        createdAt: e.createdAt,
        snapshot: e.snapshot,
        payouts: e.payouts.map((p) => ({
          id: p.id,
          amountCents: p.amount.toString(),
          status: p.status,
          createdAt: p.createdAt,
        })),
      })),
      nextCursor: rows.length > 50 ? rows[49].id : null,
    };
  }
  @Get('treasury') @Header('Cache-Control', 'no-store') @Roles('admin') async treasury(
    @Req() r: AuthRequest,
  ) {
    return this.db.$transaction(
      async (tx) => {
        const tenantId = r.actor.tenantId;
        const totals = await tx.$queryRaw<
          Array<{ kind: string; amount: bigint }>
        >`SELECT a.kind, sum(e.amount)::bigint AS amount FROM "LedgerAccount" a JOIN "LedgerEntry" e ON e."accountId"=a.id AND e."tenantId"=a."tenantId" JOIN "LedgerTransaction" t ON t.id=e."transactionId" AND t."tenantId"=e."tenantId" WHERE a."tenantId"=${tenantId}::uuid AND t.status='posted' GROUP BY a.kind`;
        const value = (kind: string) => totals.find((t) => t.kind === kind)?.amount ?? 0n;
        const pending = await tx.financePayout.aggregate({
          where: { tenantId, status: { in: ['pending', 'unknown'] } },
          _sum: { amount: true },
        });
        const earned = await tx.financeEarning.aggregate({
          where: { tenantId },
          _sum: { amount: true },
        });
        const paid = await tx.financePayout.aggregate({
          where: { tenantId, status: 'paid' },
          _sum: { amount: true },
        });
        const unbalanced = await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT t.id FROM "LedgerTransaction" t LEFT JOIN "LedgerEntry" e ON e."transactionId"=t.id AND e."tenantId"=t."tenantId" WHERE t."tenantId"=${tenantId}::uuid GROUP BY t.id HAVING coalesce(sum(e.amount),0) <> 0 OR count(e.id)<2 OR t.status<>'posted' LIMIT 1`;
        const merchant = -(value('available') + value('reserved'));
        const due = (earned._sum.amount ?? 0n) - (paid._sum.amount ?? 0n);
        return {
          mode: 'sandbox',
          cashCents: value('cash').toString(),
          merchantCreditCents: merchant.toString(),
          pendingPayoutCents: (pending._sum.amount ?? 0n).toString(),
          freeCashCents: (value('cash') - merchant - (pending._sum.amount ?? 0n)).toString(),
          dueCents: due.toString(),
          revenueCents: (-value('revenue')).toString(),
          costCents: value('expense').toString(),
          accountingConsistent: !unbalanced.length && -value('payable') === due,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  @Post('payouts') @Roles('admin') payout(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') key: string,
    @Body() b: PayoutDto,
  ) {
    return financialCommand(this.db, r.actor, key, 'payout.create', b, async (tx) => {
      const earning = await tx.financeEarning.findUnique({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id: b.earningId } },
      });
      if (!earning) throw new NotFoundException();
      const active = await tx.financePayout.findFirst({
        where: {
          tenantId: r.actor.tenantId,
          earningId: earning.id,
          status: { in: ['pending', 'unknown', 'paid'] },
        },
      });
      if (active) {
        if (active.scenario !== b.scenario)
          throw new ConflictException('Ganho já comprometido com outro cenário.');
        return active;
      }
      // Caixa disponível desconta todo crédito não consumido de lojas e repasses já comprometidos.
      const sums = await tx.ledgerEntry.groupBy({
        by: ['accountId'],
        where: {
          tenantId: r.actor.tenantId,
          transaction: { status: 'posted' },
          account: { kind: { in: ['cash', 'available', 'reserved'] } },
        },
        _sum: { amount: true },
      });
      const cashFree = sums.reduce((n, a) => n + (a._sum.amount ?? 0n), 0n);
      const pending = await tx.financePayout.aggregate({
        where: { tenantId: r.actor.tenantId, status: { in: ['pending', 'unknown'] } },
        _sum: { amount: true },
      });
      if (cashFree - (pending._sum.amount ?? 0n) < earning.amount)
        throw new ConflictException(
          'Caixa simulado livre insuficiente. Créditos das lojas ainda não consumidos não financiam repasses.',
        );
      return tx.financePayout.create({
        data: {
          tenantId: r.actor.tenantId,
          earningId: earning.id,
          amount: earning.amount,
          destination: 'sandbox',
          actorId: r.actor.id,
          scenario: b.scenario,
        },
      });
    });
  }
  @Post('payouts/:id/process') @Roles('admin') process(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string,
    @Body() b: FinanceReasonDto,
  ) {
    return financialCommand(this.db, r.actor, key, 'payout.process', { id, ...b }, async (tx) => {
      const payout = await tx.financePayout.findUnique({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
        include: { earning: true },
      });
      if (!payout) throw new NotFoundException();
      if (!['pending', 'unknown'].includes(payout.status)) return payout;
      // Simulator only: no request to an external PSP and no real Pix destination.
      const status =
        payout.scenario === 'decline'
          ? 'rejected'
          : payout.scenario === 'timeout_after_accept' && payout.status === 'pending'
            ? 'unknown'
            : 'paid';
      if (status === 'paid') {
        const payable = await account(tx, r.actor.tenantId, 'payable', payout.earning.courierId),
          cash = await account(tx, r.actor.tenantId, 'cash');
        await post(
          tx,
          r.actor.tenantId,
          r.actor.id,
          `payout:${id}`,
          'Repasse confirmado pelo simulador',
          payable.id,
          cash.id,
          payout.amount,
        );
      }
      return tx.financePayout.update({ where: { id }, data: { status } });
    });
  }
  @Post('payouts/:id/return') @Roles('admin') returned(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string,
    @Body() b: FinanceReasonDto,
  ) {
    return financialCommand(this.db, r.actor, key, 'payout.return', { id, ...b }, async (tx) => {
      const payout = await tx.financePayout.findUnique({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
        include: { earning: true },
      });
      if (!payout) throw new NotFoundException();
      if (payout.status === 'returned') return payout;
      if (payout.status !== 'paid')
        throw new ConflictException('Somente um repasse confirmado pode ter devolução simulada.');
      const payable = await account(tx, r.actor.tenantId, 'payable', payout.earning.courierId),
        cash = await account(tx, r.actor.tenantId, 'cash');
      await post(
        tx,
        r.actor.tenantId,
        r.actor.id,
        `payout-return:${id}`,
        'Devolução simulada do repasse',
        cash.id,
        payable.id,
        payout.amount,
      );
      return tx.financePayout.update({ where: { id }, data: { status: 'returned' } });
    });
  }
}
