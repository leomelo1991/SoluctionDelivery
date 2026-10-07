import { execFileSync } from 'node:child_process';
export default function teardown() {
  execFileSync(
    'corepack',
    ['pnpm', '--filter', '@solution/api', 'exec', 'tsx', 'scripts/e2e-fixture.ts', 'cleanup'],
    { stdio: 'inherit' },
  );
}
