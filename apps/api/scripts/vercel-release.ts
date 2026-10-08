import { spawnSync } from 'node:child_process';
import { demoPassword } from './demo-seed.js';

if (process.env.VERCEL_ENV !== 'production') {
  console.log('Preview: migrations e seed não são executados.');
} else {
  const seed = process.env.ALLOW_DEMO_SEED === 'true';
  if (seed) demoPassword({ ...process.env, NODE_ENV: 'production' });
  const commands = [['corepack', 'pnpm', 'db:migrate']];
  if (seed) commands.push([process.execPath, 'dist/scripts/seed-demo.js']);
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
