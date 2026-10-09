import { Database } from '../src/database.js';
import { config } from '../src/config.js';
if (config.NODE_ENV === 'production') throw new Error('E2E cleanup forbidden in production');
const db = new Database();
try {
  const tenant = await db.tenant.findFirst({
    where: { id: process.argv[2], slug: { startsWith: 'e2e-' } },
  });
  if (!tenant) throw new Error('Expected an isolated E2E tenant');
  await db.$transaction(async (tx) => {
    const where = { tenantId: tenant.id, externalReference: 'DEMO-BROWSER', mode: 'demo' };
    const orders = await tx.externalOrder.findMany({ where, select: { deliveryId: true } });
    const ids = orders.flatMap((order) => (order.deliveryId ? [order.deliveryId] : []));
    await tx.deliveryEvent.deleteMany({ where: { tenantId: tenant.id, deliveryId: { in: ids } } });
    await tx.deliveryOffer.deleteMany({ where: { tenantId: tenant.id, deliveryId: { in: ids } } });
    await tx.externalOrder.deleteMany({ where });
    await tx.delivery.deleteMany({ where: { tenantId: tenant.id, id: { in: ids } } });
  });
} finally {
  await db.$disconnect();
}
