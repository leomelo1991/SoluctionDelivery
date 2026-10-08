import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { Actor } from '../../http/security.js';
import { account, post, type Tx } from './ledger.js';
export async function closeReservation(tx: Tx, actor: Actor, id: string, consumed: bigint) {
  const v = await tx.financeReservation.findUnique({
    where: { tenantId_id: { tenantId: actor.tenantId, id } },
  });
  if (!v) throw new NotFoundException();
  if (v.status === 'closed') {
    if (v.consumed !== consumed)
      throw new ConflictException('Reserva já encerrada com outro valor.');
    return v;
  }
  if (consumed < 0n || consumed > v.amount)
    throw new BadRequestException('Consumo não pode exceder a reserva.');
  const reserved = await account(tx, actor.tenantId, 'reserved', v.establishmentId);
  if (consumed > 0n) {
    const revenue = await account(tx, actor.tenantId, 'revenue');
    await post(
      tx,
      actor.tenantId,
      actor.id,
      `consume:${v.id}`,
      'Consumo simulado da reserva',
      reserved.id,
      revenue.id,
      consumed,
    );
  }
  if (v.amount > consumed) {
    const available = await account(tx, actor.tenantId, 'available', v.establishmentId);
    await post(
      tx,
      actor.tenantId,
      actor.id,
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
}
