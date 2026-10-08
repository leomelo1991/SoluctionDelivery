import type { Database } from '../src/database.js';
import * as argon2 from 'argon2';

export function demoPassword(env: NodeJS.ProcessEnv): string {
  if (env.ALLOW_DEMO_SEED !== 'true')
    throw new Error('Defina ALLOW_DEMO_SEED=true para autorizar o seed demo.');
  if (env.NODE_ENV === 'production' && env.ALLOW_PRODUCTION_DEMO_SEED !== 'true')
    throw new Error('Produção exige também ALLOW_PRODUCTION_DEMO_SEED=true.');
  if (!env.DEMO_PASSWORD || env.DEMO_PASSWORD.length < 12 || env.DEMO_PASSWORD.length > 128)
    throw new Error('Defina DEMO_PASSWORD com 12 a 128 caracteres.');
  return env.DEMO_PASSWORD;
}

export async function seedDemo(db: Database, password: string, slug = 'demo') {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731904281)::text`;
      if (await tx.tenant.findUnique({ where: { slug } })) return false;
      const t = await tx.tenant.create({ data: { slug, name: 'Operação demonstrativa' } });
      const address = {
        street: 'Rua das Flores',
        number: '120',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        postalCode: '01001000',
      };
      const store = await tx.establishment.create({
        data: {
          tenantId: t.id,
          name: 'Cozinha da Vila',
          responsible: 'Operador Demo',
          phone: '11999990000',
          email: 'loja@example.test',
          city: 'São Paulo',
          address,
          lifecycleStatus: 'active',
          operationOpen: true,
        },
      });
      const courier = await tx.courier.create({
        data: {
          tenantId: t.id,
          name: 'Entregador Demo',
          phone: '11999990001',
          vehicle: 'motorcycle',
          approvalStatus: 'approved',
          availabilityStatus: 'available',
        },
      });
      const hash = await argon2.hash(password);
      for (const [role, name, email] of [
        ['admin', 'Administrador Demo', 'admin@example.test'],
        ['establishment', 'Operador Demo', 'loja@example.test'],
        ['courier', 'Entregador Demo', 'entregador@example.test'],
      ] as const)
        await tx.user.create({
          data: {
            tenantId: t.id,
            role,
            name,
            email,
            passwordHash: hash,
            mustChangePassword: true,
            ...(role === 'establishment'
              ? { establishmentId: store.id }
              : role === 'courier'
                ? { courierId: courier.id }
                : {}),
          },
        });
      await tx.pricingConfig.create({
        data: {
          tenantId: t.id,
          fee: { baseCents: 500, includedMeters: 1000, perKmCents: 200, minimumCents: 700 },
          payout: { baseCents: 400, includedMeters: 1000, perKmCents: 150, minimumCents: 500 },
        },
      });
      await tx.region.create({
        data: {
          tenantId: t.id,
          name: 'Centro',
          city: 'São Paulo',
          coverage: 'Bairros centrais; conferir cobertura antes de selecionar.',
          feeCents: 1000,
          payoutCents: 800,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: t.id,
          entity: 'tenant',
          entityId: t.id,
          action: 'demo_seed',
          changes: { demo: true },
        },
      });
      return true;
    },
    { timeout: 30000 },
  );
}
