import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Database } from '../../database.js';
import { atomic, inputHash } from '../transactions.js';
import { account, financeLock, post, type Tx } from './ledger.js';
import { SandboxProvider, type SandboxGateway, type SandboxOutcome } from './sandbox-provider.js';

export async function applySandboxEvent(
  tx: Tx,
  tenantId: string,
  topupId: string,
  event: { eventId: string; outcome: SandboxOutcome },
) {
  const topup = await tx.financeTopup.findUniqueOrThrow({
    where: { tenantId_id: { tenantId, id: topupId } },
  });
  const hash = inputHash({ topupId, ...event });
  const old = await tx.financeProviderEvent.findUnique({
    where: {
      tenantId_provider_environment_eventId: {
        tenantId,
        provider: 'fake',
        environment: 'sandbox',
        eventId: event.eventId,
      },
    },
  });
  if (old) {
    if (old.inputHash !== hash) throw new ConflictException('Evento financeiro inconsistente.');
    return;
  }
  await tx.financeProviderEvent.create({
    data: { tenantId, topupId, eventId: event.eventId, inputHash: hash, outcome: event.outcome },
  });
  if (['confirmed', 'rejected'].includes(topup.status)) return; // Não reabre nem rebaixa resultado final.
  if (event.outcome === 'confirmed') {
    const cash = await account(tx, tenantId, 'cash');
    const available = await account(tx, tenantId, 'available', topup.establishmentId);
    await post(
      tx,
      tenantId,
      topup.actorId,
      `fund:${topup.id}`,
      'Crédito de simulação confirmado',
      cash.id,
      available.id,
      topup.amount,
    );
  }
  await tx.financeTopup.update({ where: { id: topup.id }, data: { status: event.outcome } });
}
@Injectable()
export class FinanceWorker {
  constructor(@Inject(Database) private db: Database) {}
  async run(tenantId: string, provider: SandboxGateway = new SandboxProvider(this.db, tenantId)) {
    // Reclama no máximo 5 itens. Não mantém transação aberta ao executar o adapter.
    const leaseToken = randomUUID();
    const tasks = await this.db.$queryRaw<Array<{ id: string; topupId: string; attempts: number }>>`
      UPDATE "FinanceTask" SET status='processing', "leaseToken"=${leaseToken}::uuid, "leaseUntil"=now()+interval '30 seconds', attempts=attempts+1
      WHERE id IN (SELECT id FROM "FinanceTask" WHERE "tenantId"=${tenantId}::uuid AND ((status='pending' AND "nextAttemptAt"<=now()) OR (status='processing' AND "leaseUntil"<now())) ORDER BY "createdAt",id LIMIT 5 FOR UPDATE SKIP LOCKED)
      RETURNING id,"topupId",attempts`;
    let completed = 0;
    for (const task of tasks) {
      try {
        const topup = await this.db.financeTopup.findUniqueOrThrow({
          where: { tenantId_id: { tenantId, id: task.topupId } },
        });
        // Qualquer retomada consulta pela mesma referência; jamais cria outra tentativa externa.
        let event =
          task.attempts > 1 || topup.status === 'unknown'
            ? await provider.lookup(topup.id, topup.scenario)
            : await provider.submit(topup.id, topup.scenario);
        if (!event) event = await provider.submit(topup.id, topup.scenario);
        const confirmedEvent = event;
        const applied = await atomic(this.db, async (tx) => {
          await financeLock(tx, tenantId);
          const claimed = await tx.financeTask.findFirst({
            where: { id: task.id, tenantId, status: 'processing', leaseToken },
          });
          if (!claimed) return false;
          await applySandboxEvent(tx, tenantId, topup.id, confirmedEvent);
          await tx.financeTask.update({
            where: { id: task.id },
            data: { status: 'done', leaseToken: null, leaseUntil: null, errorCode: null },
          });
          return true;
        });
        if (applied) completed++;
      } catch {
        await atomic(this.db, async (tx) => {
          await financeLock(tx, tenantId);
          const updated = await tx.financeTask.updateMany({
            where: { id: task.id, tenantId, leaseToken, status: 'processing' },
            data: {
              status: 'pending',
              leaseToken: null,
              leaseUntil: null,
              errorCode: 'RESULT_UNCONFIRMED',
              nextAttemptAt: new Date(Date.now() + Math.min(60000, 2000 * task.attempts)),
            },
          });
          if (updated.count)
            await tx.financeTopup.updateMany({
              where: { id: task.topupId, tenantId, status: 'pending' },
              data: { status: 'unknown' },
            });
        });
      }
    }
    return { mode: 'sandbox', claimed: tasks.length, completed };
  }
}
