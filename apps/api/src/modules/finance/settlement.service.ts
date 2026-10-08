import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { Actor } from '../../http/security.js';
import type { ContractTerms } from '../../domain/finance/contracts.js';
import { durationMinutes } from '../../domain/finance/contracts.js';
import { availabilityCharge, shiftEarning } from '../../domain/finance/settlement.js';
import { financeWeek, MAX_FINANCE_CENTS } from '../../domain/finance/money.js';
import { account, financeJson, post, wallet, type Tx } from './ledger.js';
import { closeReservation } from './reservation-close.js';
export async function settleWeek(tx: Tx, actor: Actor, versionId: string, week: string) {
  const tenantId = actor.tenantId;
  let period: ReturnType<typeof financeWeek>;
  try {
    period = financeWeek(week);
  } catch (e) {
    throw new BadRequestException((e as Error).message);
  }
  const { start, end } = period;
  const existing = await tx.financeSettlement.findUnique({
    where: { tenantId_versionId_weekStart: { tenantId, versionId, weekStart: start } },
  });
  if (existing) return existing;
  const version = await tx.contractVersion.findFirst({
    where: { id: versionId, tenantId, status: 'accepted' },
    include: { contract: true },
  });
  if (!version) throw new NotFoundException('Contrato aceito não encontrado.');
  if (start < version.effectiveFrom || end > version.effectiveTo || end > new Date())
    throw new BadRequestException(
      'Selecione uma semana encerrada e integralmente coberta pelo contrato.',
    );
  const establishmentId = version.contract.establishmentId;
  await wallet(tx, tenantId, establishmentId, false);
  const terms = version.terms as unknown as ContractTerms;
  const shifts = await tx.scheduledShift.findMany({
    where: { tenantId, versionId, startsAt: { gte: start, lt: end } },
    include: {
      allocations: {
        where: { cancelledAt: null },
        include: { attendance: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 } },
      },
    },
  });
  if (shifts.some((s) => s.endsAt > new Date()))
    throw new ConflictException('Aguarde o encerramento do último turno.');
  // Todo turno previsto precisa ser explicitamente agendado ou cancelado; ausência de cadastro não é falta comprovada.
  if (
    shifts.length !== terms.templates.length ||
    terms.templates.some((_, i) => shifts.filter((s) => s.templateIndex === i).length !== 1)
  )
    throw new ConflictException(
      'Cadastre todos os turnos previstos para a semana antes de apurar.',
    );
  const allocations = shifts
    .filter((s) => s.status !== 'cancelled')
    .flatMap((s) => s.allocations.map((a) => ({ ...a, shift: s })));
  if (allocations.some((a) => !a.attendance.length))
    throw new ConflictException(
      'Registre a presença de cada alocação, inclusive zero para faltas.',
    );
  const reservations = await tx.financeReservation.findMany({
    where: {
      tenantId,
      versionId,
      kind: 'delivery',
      delivery: { createdAt: { gte: start, lt: end } },
    },
    include: { delivery: true },
    take: 2001,
  });
  if (reservations.length > 2000)
    throw new ConflictException('Semana excede o limite de apuração por lote.');
  if (reservations.some((r) => r.delivery?.status !== 'delivered' || !r.delivery.courierId))
    throw new ConflictException(
      'Conclua as entregas com reserva desta semana antes do fechamento.',
    );
  const counts = new Map<string, number>();
  for (const r of reservations) {
    const d = r.delivery!;
    const matches = allocations.filter(
      (a) => a.courierId === d.courierId && a.startsAt <= d.createdAt && a.endsAt > d.createdAt,
    );
    if (matches.length !== 1)
      throw new ConflictException(
        'Entrega sem alocação única no horário de criação. Revise a escala antes de fechar.',
      );
    counts.set(matches[0].id, (counts.get(matches[0].id) ?? 0) + 1);
  }
  const merchant = availabilityCharge(
    terms,
    allocations.reduce((n, a) => n + a.attendance[0].attendedMinutes, 0),
  );
  const minimum = merchant.availability + merchant.platform;
  const reservedMinimum = await tx.financeReservation.findUnique({
    where: { tenantId_source: { tenantId, source: `week:${versionId}:${week}` } },
  });
  if (!reservedMinimum && terms.weeklyAvailabilityCents + terms.platformFeeCents > 0)
    throw new ConflictException('Reserve o mínimo semanal antes de fechar.');
  const variable = reservations.reduce((n, r) => n + r.amount, 0n);
  const total = minimum + variable;
  if (total > MAX_FINANCE_CENTS) throw new BadRequestException('Total excede o limite financeiro.');
  const groups = new Map<
    string,
    {
      allocationIds: string[];
      attendanceIds: string[];
      shiftId: string;
      courierId: string;
      attendedMinutes: number;
      deliveries: number;
      shiftMinutes: number;
    }
  >();
  for (const a of allocations) {
    const key = `${a.shiftId}:${a.courierId}`;
    const g = groups.get(key) ?? {
      allocationIds: [],
      attendanceIds: [],
      shiftId: a.shiftId,
      courierId: a.courierId,
      attendedMinutes: 0,
      deliveries: 0,
      shiftMinutes: durationMinutes(terms.templates[a.shift.templateIndex]),
    };
    g.allocationIds.push(a.id);
    g.attendanceIds.push(a.attendance[0].id);
    g.attendedMinutes += a.attendance[0].attendedMinutes;
    g.deliveries += counts.get(a.id) ?? 0;
    groups.set(key, g);
  }
  const earnings = [...groups.values()].map((g) => ({
    ...g,
    ...shiftEarning(terms, g.attendedMinutes, g.shiftMinutes, g.deliveries),
  }));
  if (reservedMinimum) await closeReservation(tx, actor, reservedMinimum.id, minimum);
  for (const r of reservations) await closeReservation(tx, actor, r.id, r.amount);
  const result = await tx.financeSettlement.create({
    data: {
      tenantId,
      establishmentId,
      versionId,
      weekStart: start,
      actorId: actor.id,
      total,
      snapshot: financeJson({
        policy: 'sandbox_attendance_v1',
        weekEnd: end,
        terms,
        ...merchant,
        variable,
        total,
        deliveries: reservations.map((r) => ({
          id: r.deliveryId,
          reservationId: r.id,
          amount: r.amount,
        })),
        released: reservedMinimum ? reservedMinimum.amount - minimum : 0n,
        earnings,
      }),
    },
  });
  const expense = await account(tx, tenantId, 'expense');
  for (const e of earnings) {
    if (!e.total) continue;
    const earning = await tx.financeEarning.create({
      data: {
        tenantId,
        settlementId: result.id,
        courierId: e.courierId,
        source: `shift:${e.shiftId}:courier:${e.courierId}`,
        amount: e.total,
        snapshot: financeJson(e),
      },
    });
    const payable = await account(tx, tenantId, 'payable', e.courierId);
    await post(
      tx,
      tenantId,
      actor.id,
      `earning:${earning.id}`,
      'Remuneração apurada (simulação)',
      expense.id,
      payable.id,
      e.total,
    );
  }
  return result;
}
