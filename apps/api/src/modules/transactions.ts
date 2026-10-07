import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import type { Database } from '../database.js';
import type { Actor } from '../http/security.js';
export const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object' && !(value instanceof Date))
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export const inputHash = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
export async function atomic<T>(
  db: Database,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(fn, { isolationLevel: 'Serializable', timeout: 10000 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034' && attempt < 2)
        continue;
      throw e;
    }
  }
  throw new ConflictException();
}
export async function command(
  db: Database,
  actor: Actor,
  key: string | undefined,
  name: string,
  input: unknown,
  fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
) {
  if (!key || key.length < 8 || key.length > 128)
    throw new BadRequestException({
      code: 'IDEMPOTENCY_REQUIRED',
      message: 'Informe uma chave de idempotência válida.',
    });
  return atomic(db, async (tx) => {
    const old = await tx.idempotency.findUnique({
      where: { tenantId_userId_key: { tenantId: actor.tenantId, userId: actor.id, key } },
    });
    const hash = inputHash(input);
    if (old) {
      if (old.command !== name || old.inputHash !== hash)
        throw new ConflictException({
          code: 'IDEMPOTENCY_MISMATCH',
          message: 'A chave já foi usada em outra operação.',
        });
      return old.response;
    }
    const result = await fn(tx);
    await tx.idempotency.create({
      data: {
        tenantId: actor.tenantId,
        userId: actor.id,
        key,
        command: name,
        inputHash: hash,
        response: json(result),
      },
    });
    return result;
  });
}
export async function audit(
  tx: Prisma.TransactionClient,
  a: Actor,
  entity: string,
  entityId: string,
  action: string,
  changes: unknown,
  reason?: string,
) {
  await tx.auditEvent.create({
    data: {
      tenantId: a.tenantId,
      actorUserId: a.id,
      entity,
      entityId,
      action,
      changes: json(changes),
      reason,
    },
  });
}
