import { Database } from '../src/database.js';
import { z } from 'zod';
import * as argon2 from 'argon2';
const input = z
  .object({
    TENANT_SLUG: z.string().regex(/^[a-z0-9][a-z0-9-]{1,79}$/),
    TENANT_NAME: z.string().min(2),
    ADMIN_NAME: z.string().min(2),
    ADMIN_EMAIL: z.email(),
    ADMIN_PASSWORD: z.string().min(12).max(128),
  })
  .parse(process.env);
const db = new Database();
try {
  const exists = await db.tenant.findUnique({ where: { slug: input.TENANT_SLUG } });
  if (exists) throw new Error('Empresa já provisionada; nenhuma alteração realizada.');
  await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { slug: input.TENANT_SLUG, name: input.TENANT_NAME },
    });
    const admin = await tx.user.create({
      data: {
        tenantId: tenant.id,
        name: input.ADMIN_NAME,
        email: input.ADMIN_EMAIL.toLowerCase(),
        role: 'admin',
        passwordHash: await argon2.hash(input.ADMIN_PASSWORD),
      },
    });
    await tx.auditEvent.create({
      data: {
        tenantId: tenant.id,
        actorUserId: admin.id,
        entity: 'tenant',
        entityId: tenant.id,
        action: 'provisioned',
        changes: { slug: tenant.slug },
      },
    });
  });
  console.log('Empresa e administrador criados. A primeira entrada exigirá troca de senha.');
} finally {
  await db.$disconnect();
}
