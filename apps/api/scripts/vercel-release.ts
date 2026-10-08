import { spawnSync } from 'node:child_process';
import { demoPassword } from './demo-seed.js';
import { diagnoseMigrations } from './migration-diagnostics.js';

if (process.env.VERCEL_ENV !== 'production') {
  console.log('Preview: migrations e seed não são executados.');
} else {
  const seed = process.env.ALLOW_DEMO_SEED === 'true';
  const investors = process.env.SEED_INVESTORS === 'true';
  if (seed || investors) demoPassword({ ...process.env, NODE_ENV: 'production' });
  await diagnoseMigrations(process.env);
  const commands = [['corepack', 'pnpm', 'db:migrate']];
  if (seed) commands.push([process.execPath, 'dist/scripts/seed-demo.js']);
  if (investors) commands.push([process.execPath, 'dist/scripts/seed-investors.js']);
  for (const [command, ...args] of commands) {
    const result = spawnSync(command!, args, {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' },
    });
    if (result.error || result.status !== 0) {
      console.error('Falha na preparação do banco; deploy interrompido.');
      process.exit(result.status || 1);
    }
  }
}
