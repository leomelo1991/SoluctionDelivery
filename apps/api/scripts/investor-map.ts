import type { Database } from '../src/database.js';
import { francaCep } from '../src/modules/cep-location.js';
import { mapAddressHash } from '../src/modules/operations-map.js';
import type { AddressDto } from '../src/http/dto.js';
const action = 'investor-cep-map-v1';
// Candidates are used only after BrasilAPI confirms Franca/SP and valid coordinates.
const candidates = [
  '14400320',
  '14400100',
  '14400200',
  '14400300',
  '14400400',
  '14400500',
  '14400600',
  '14400700',
];
export async function enrichInvestorMap(db: Database, slug = 'investidores') {
  const tenant = await db.tenant.findUnique({ where: { slug } });
  if (
    !tenant ||
    !(await db.auditEvent.findFirst({
      where: { tenantId: tenant.id, action: 'investor-presentation-v1' },
    }))
  )
    return 0;
  if (await db.auditEvent.findFirst({ where: { tenantId: tenant.id, action } })) return 0;
  const responses = await Promise.all(candidates.map(francaCep));
  const locations = [
    ...new Map(
      responses
        .filter((p) => p !== null)
        .map((p) => [`${p.point.latitude},${p.point.longitude}`, p]),
    ).values(),
  ];
  if (locations.length < 2) {
    console.warn(
      'Mapa demonstrativo pendente: BrasilAPI não retornou dois CEPs distintos de Franca com coordenadas. Nenhum endereço foi alterado.',
    );
    return 0;
  }
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731904283)::text`;
      if (await tx.auditEvent.findFirst({ where: { tenantId: tenant.id, action } })) return 0;
      const stores = await tx.establishment.findMany({
        where: { tenantId: tenant.id, city: 'Franca' },
        orderBy: { id: 'asc' },
      });
      const addresses = locations.map(
        (p): AddressDto => ({
          street: p.street || 'Área do CEP',
          number: 's/n',
          district: p.district || 'Área do CEP',
          city: 'Franca',
          state: 'SP',
          postalCode: p.cep,
          complement:
            'Localização aproximada por CEP — cenário fictício, não usar para entrega real',
        }),
      );
      const storeAddress = new Map<string, AddressDto>();
      for (const [index, store] of stores.entries()) {
        if (!/^(loja|parceiro[1-9])@example\.test$/.test(store.email)) continue;
        const address = addresses[index % addresses.length];
        storeAddress.set(store.id, address);
        await tx.establishment.update({
          where: { id: store.id },
          data: { address: { ...address } },
        });
      }
      const deliveries = await tx.delivery.findMany({
        where: {
          tenantId: tenant.id,
          pricingSnapshot: { path: ['batch'], equals: 'investor-presentation-v1' },
        },
        orderBy: { id: 'asc' },
        select: { id: true, establishmentId: true },
      });
      const updates = deliveries.flatMap((d, index) => {
        const pickup = storeAddress.get(d.establishmentId);
        if (!pickup) return [];
        let destination = addresses[index % addresses.length];
        if (destination.postalCode === pickup.postalCode)
          destination = addresses[(index + 1) % addresses.length];
        return [{ id: d.id, pickup, destination }];
      });
      if (updates.length)
        await tx.$executeRaw`
      UPDATE "Delivery" d SET "pickupAddress" = u.pickup, "destinationAddress" = u.destination
      FROM jsonb_to_recordset(${JSON.stringify(updates)}::jsonb) AS u(id uuid, pickup jsonb, destination jsonb)
      WHERE d.id = u.id AND d."tenantId" = ${tenant.id}::uuid AND d."pricingSnapshot" ->> 'batch' = 'investor-presentation-v1'`;
      for (const [index, address] of addresses.entries()) {
        const key = { tenantId: tenant.id, addressHash: mapAddressHash(address) };
        const data = {
          ...locations[index].point,
          status: 'approximate',
          expiresAt: new Date(Date.now() + 27 * 86400000),
        };
        await tx.mapGeocode.upsert({
          where: { tenantId_addressHash: key },
          create: { ...key, ...data },
          update: data,
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId: tenant.id,
          entity: 'tenant',
          entityId: action,
          action,
          changes: {
            source: 'BrasilAPI CEP v2',
            approximate: true,
            ceps: locations.map((p) => p.cep),
            deliveries: updates.length,
          },
          reason: 'Coordenadas por CEP para apresentação fictícia, sem simular GPS real.',
        },
      });
      return updates.length;
    },
    { timeout: 30000 },
  );
}
