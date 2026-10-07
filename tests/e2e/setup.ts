import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
export default function setup() {
  mkdirSync('test-results', { recursive: true });
  execFileSync(
    'corepack',
    ['pnpm', '--filter', '@solution/api', 'exec', 'tsx', 'scripts/e2e-fixture.ts'],
    { stdio: 'inherit' },
  );
}
