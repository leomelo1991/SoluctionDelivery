import { Database } from '../src/database.js';
import { config } from '../src/config.js';
import { demoPassword, seedDemo } from './demo-seed.js';

const password = demoPassword({ ...process.env, NODE_ENV: config.NODE_ENV });
const db = new Database();
try {
  const created = await seedDemo(db, password);
  console.log(
    created
      ? 'Demo criada. Empresa: demo. Usuários: admin@example.test, loja@example.test e entregador@example.test.'
      : 'Empresa demo já existe. Nenhum dado ou senha foi alterado.',
  );
} finally {
  await db.$disconnect();
}
