import { readFile, writeFile } from 'node:fs/promises';
import { Database } from '../src/database.js';
import { config } from '../src/config.js';
import { cleanup, fixture } from '../test/fixtures.js';
if (config.NODE_ENV === 'production') throw new Error('E2E forbidden in production');
const db = new Database();
try {
  if (process.argv[2] === 'cleanup') {
    const f = JSON.parse(await readFile('../../test-results/settlement-fixture.json', 'utf8'));
    await cleanup(db, f.tenant.id);
  } else {
    const f = await fixture(db);
    await writeFile('../../test-results/settlement-fixture.json', JSON.stringify(f));
    const contract = await db.merchantContract.create({
      data: {
        tenantId: f.tenant.id,
        establishmentId: f.store.id,
        title: 'Contrato encerrado para apuração',
      },
    });
    const version = await db.contractVersion.create({
      data: {
        tenantId: f.tenant.id,
        contractId: contract.id,
        number: 1,
        status: 'accepted',
        effectiveFrom: new Date('2026-09-01T03:00:00Z'),
        effectiveTo: new Date('2026-10-01T03:00:00Z'),
        terms: {
          timezone: 'America/Sao_Paulo',
          coverage: 'Franca',
          servicePolicy: 'Proporcional',
          weeklyAvailabilityCents: 80000,
          platformFeeCents: 0,
          deliveryFeeCents: 200,
          payModel: 'guarantee',
          courierFixedCents: 10000,
          courierDeliveryCents: 1000,
          templates: [
            {
              weekday: 1,
              startMinute: 600,
              endMinute: 700,
              courierCount: 1,
              expectedDeliveries: 5,
            },
          ],
        },
      },
    });
    const shift = await db.scheduledShift.create({
      data: {
        tenantId: f.tenant.id,
        versionId: version.id,
        templateIndex: 0,
        capacity: 1,
        startsAt: new Date('2026-09-07T13:00:00Z'),
        endsAt: new Date('2026-09-07T14:40:00Z'),
      },
    });
    const allocation = await db.courierAllocation.create({
      data: {
        tenantId: f.tenant.id,
        shiftId: shift.id,
        courierId: f.courier.id,
        position: 1,
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
      },
    });
    await db.attendanceEvent.create({
      data: {
        tenantId: f.tenant.id,
        allocationId: allocation.id,
        actorUserId: f.admin.id,
        attendedMinutes: 90,
        reason: 'Presença parcial para teste de fechamento',
      },
    });
    await writeFile(
      '../../test-results/settlement-fixture.json',
      JSON.stringify({ ...f, version }),
    );
  }
} finally {
  await db.$disconnect();
}
