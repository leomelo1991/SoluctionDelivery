import type { Prisma } from '../src/generated/prisma/client.js';

const action = 'investor-franca-v1';
const districtMap = JSON.stringify({
  Jardins: 'Estação',
  'Vila Mariana': 'Cidade Nova',
  Pinheiros: 'Vila Aparecida',
  'Bela Vista': 'Jardim Consolação',
});

// One-time correction of the original synthetic batch; preserve money, dates and credentials.
export async function localizeInvestors(tx: Prisma.TransactionClient, tenantId: string) {
  if (await tx.auditEvent.findFirst({ where: { tenantId, action } })) return false;
  await tx.$executeRaw`
    UPDATE "Establishment" SET city = 'Franca',
      address = address || '{"city":"Franca","state":"SP","postalCode":"14400000","complement":"Endereço fictício para apresentação em Franca"}'::jsonb,
      phone = CASE WHEN phone IN ('11000000000', '11999990000') THEN '16000000000' ELSE phone END
    WHERE "tenantId" = ${tenantId}::uuid AND city = 'São Paulo'
      AND (email = 'loja@example.test' OR email ~ '^parceiro[1-9]@example\\.test$')`;
  await tx.$executeRaw`
    UPDATE "Region" SET city = 'Franca', name = COALESCE(${districtMap}::jsonb ->> name, name),
      coverage = 'Cobertura fictícia para apresentação em Franca–SP'
    WHERE "tenantId" = ${tenantId}::uuid AND city = 'São Paulo'
      AND name IN ('Centro', 'Jardins', 'Vila Mariana', 'Pinheiros', 'Bela Vista')`;
  await tx.$executeRaw`
    UPDATE "Delivery" SET
      "pickupAddress" = "pickupAddress" || '{"city":"Franca","state":"SP","postalCode":"14400000"}'::jsonb,
      "destinationAddress" = "destinationAddress" || jsonb_build_object('city', 'Franca', 'state', 'SP', 'postalCode', '14400000', 'district', COALESCE(${districtMap}::jsonb ->> ("destinationAddress" ->> 'district'), "destinationAddress" ->> 'district')),
      "pricingSnapshot" = "pricingSnapshot" || jsonb_build_object('regionName', COALESCE(${districtMap}::jsonb ->> ("pricingSnapshot" ->> 'regionName'), "pricingSnapshot" ->> 'regionName')),
      "recipientPhone" = '16000000000'
    WHERE "tenantId" = ${tenantId}::uuid AND "pricingSnapshot" ->> 'batch' = 'investor-presentation-v1'`;
  await tx.courier.updateMany({
    where: { tenantId, phone: { in: ['11000000000', '11999990001'] } },
    data: { phone: '16000000000' },
  });
  await tx.tenant.updateMany({
    where: {
      id: tenantId,
      name: { in: ['Apresentação — dados fictícios', 'Operação demonstrativa'] },
    },
    data: { name: 'Franca–SP — apresentação fictícia' },
  });
  await tx.auditEvent.create({
    data: {
      tenantId,
      entity: 'tenant',
      entityId: action,
      action,
      changes: { city: 'Franca', state: 'SP', synthetic: true },
      reason: 'Adequação geográfica dos dados fictícios para apresentação.',
    },
  });
  return true;
}
