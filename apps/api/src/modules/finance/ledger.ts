import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Database } from '../../database.js';
import type { Actor } from '../../http/security.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { atomic, inputHash, audit } from '../transactions.js';
import { cents, MAX_FINANCE_CENTS } from '../../domain/finance/money.js';
export type Tx = Prisma.TransactionClient;
export const financeJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
export const amount = (value: string, zero = false) => {
  try {
    return cents(value, zero);
  } catch (e) {
    throw new BadRequestException((e as Error).message);
  }
};
export async function financeLock(tx: Tx, tenantId: string) {
  const rows = await tx.$queryRaw<
    Array<{ tenantId: string }>
  >`SELECT "tenantId" FROM "FinanceWorkspace" WHERE "tenantId"=${tenantId}::uuid AND mode='sandbox' FOR UPDATE`;
  if (!rows.length)
    throw new ConflictException('Ative o ambiente financeiro de simulação antes de continuar.');
}
export async function canManage(tx: Tx | Database, actor: Actor) {
  return (
    actor.role === 'admin' &&
    !!(await tx.financePermission.findUnique({
      where: { tenantId_userId: { tenantId: actor.tenantId, userId: actor.id } },
    }))
  );
}
export async function financialCommand(
  db: Database,
  actor: Actor,
  key: string | undefined,
  name: string,
  input: unknown,
  fn: (tx: Tx) => Promise<unknown>,
) {
  if (!key || key.length < 8 || key.length > 128)
    throw new BadRequestException('Informe uma chave de idempotência válida.');
  return atomic(db, async (tx) => {
    await financeLock(tx, actor.tenantId);
    if (!(await canManage(tx, actor)))
      throw new ForbiddenException('Sem permissão para gerenciar o financeiro de simulação.');
    const hash = inputHash({ name, input });
    const where = { tenantId_key: { tenantId: actor.tenantId, key } };
    const old = await tx.financeOperation.findUnique({ where });
    if (old) {
      if (old.inputHash !== hash)
        throw new ConflictException('Referência financeira já usada com outros dados.');
      return old.response;
    }
    const result = financeJson(await fn(tx));
    await tx.financeOperation.create({
      data: { tenantId: actor.tenantId, key, inputHash: hash, response: result },
    });
    await audit(tx, actor, 'finance', key, name, { mode: 'sandbox', input });
    return result;
  });
}
export async function wallet(tx: Tx, tenantId: string, establishmentId: string, enabled = true) {
  const w = await tx.financeWallet.findUnique({
    where: { tenantId_establishmentId: { tenantId, establishmentId } },
  });
  if (!w) throw new NotFoundException('Carteira de simulação não encontrada.');
  if (enabled && !w.enabled)
    throw new ConflictException('Novos compromissos estão pausados para esta loja.');
  return w;
}
export async function account(tx: Tx, tenantId: string, kind: string, owner = 'platform') {
  const code = `${kind}:${owner}`;
  await tx.ledgerAccount.createMany({ data: [{ tenantId, code, kind }], skipDuplicates: true });
  return tx.ledgerAccount.findUniqueOrThrow({ where: { tenantId_code: { tenantId, code } } });
}
export async function balance(
  tx: Tx | Database,
  tenantId: string,
  establishmentId: string,
  kind: 'available' | 'reserved',
) {
  const result = await tx.ledgerEntry.aggregate({
    where: {
      tenantId,
      account: { code: `${kind}:${establishmentId}` },
      transaction: { status: 'posted' },
    },
    _sum: { amount: true },
  });
  return -(result._sum.amount ?? 0n);
}
export async function post(
  tx: Tx,
  tenantId: string,
  actorId: string,
  source: string,
  description: string,
  debit: string,
  credit: string,
  value: bigint,
) {
  if (value <= 0n || value > MAX_FINANCE_CENTS || debit === credit)
    throw new BadRequestException('Lançamento financeiro inválido.');
  // Caller holds the workspace lock; origem única também protege de replay entre usuários/jobs.
  const old = await tx.ledgerTransaction.findUnique({
    where: { tenantId_source: { tenantId, source } },
  });
  if (old) throw new ConflictException('Esta origem já foi contabilizada.');
  const header = await tx.ledgerTransaction.create({
    data: { tenantId, actorId, source, description },
  });
  await tx.ledgerEntry.createMany({
    data: [
      { tenantId, transactionId: header.id, accountId: debit, amount: value },
      { tenantId, transactionId: header.id, accountId: credit, amount: -value },
    ],
  });
  await tx.ledgerTransaction.update({ where: { id: header.id }, data: { status: 'posted' } });
  return header.id;
}
