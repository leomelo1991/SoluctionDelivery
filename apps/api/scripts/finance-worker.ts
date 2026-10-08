import { Database } from '../src/database.js';
import { FinanceWorker } from '../src/modules/finance/worker.js';
const db = new Database();
try {
  const slug = process.env.TENANT_SLUG;
  if (!slug)
    throw new Error('Informe TENANT_SLUG para processar somente a simulação dessa empresa.');
  const tenant = await db.tenant.findUnique({ where: { slug } });
  if (!tenant || !(await db.financeWorkspace.findUnique({ where: { tenantId: tenant.id } })))
    throw new Error('Ambiente financeiro de simulação não habilitado.');
  console.log(JSON.stringify(await new FinanceWorker(db).run(tenant.id)));
} finally {
  await db.$disconnect();
}
