import { enrichInvestorMap } from './investor-map.js';
import { Database } from '../src/database.js';
import { config } from '../src/config.js';
import { demoPassword } from './demo-seed.js';
import { seedInvestors } from './investor-data.js';
const password = demoPassword({ ...process.env, NODE_ENV: config.NODE_ENV });
const db = new Database();
try {
  console.log(
    (await seedInvestors(db, password))
      ? 'Base fictícia de Franca–SP criada ou atualizada. Empresa: investidores. Contas: admin@example.test, loja@example.test, entregador@example.test.'
      : 'Base de apresentação já criada. Dados e senhas preservados.',
  );
  console.log(`Mapa por CEP: ${await enrichInvestorMap(db)} entregas demonstrativas atualizadas.`);
} finally {
  await db.$disconnect();
}
