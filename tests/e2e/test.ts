import { test as base } from '@playwright/test';
import { execFileSync } from 'node:child_process';
// Each journey gets a fresh LOGIN counter in a dedicated E2E namespace.
// Limits within a journey and all production limits are unchanged.
export const test = base.extend<{ isolatedRateLimit: void }>({
  isolatedRateLimit: [
    async ({}, use) => {
      execFileSync(
        'corepack',
        ['pnpm', '--filter', '@solution/api', 'exec', 'tsx', 'scripts/e2e-rate-reset.ts'],
        { stdio: 'pipe', env: { ...process.env, NODE_ENV: 'test' } },
      );
      await use();
    },
    { auto: true },
  ],
});
export { expect, type Page } from '@playwright/test';
