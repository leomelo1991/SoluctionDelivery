import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'drafts.spec.ts',
  workers: 1,
  use: {
    baseURL: 'http://localhost:5174',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'corepack pnpm --filter @solution/web dev --port 5174',
    cwd: '../../..',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
  },
});
