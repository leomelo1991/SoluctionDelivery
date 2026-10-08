import { defineConfig, devices } from '@playwright/test';
const webPort = process.env.E2E_WEB_PORT ?? '5173';
const webOrigin = `http://localhost:${webPort}`;
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: webOrigin,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './tests/e2e/setup.ts',
  globalTeardown: './tests/e2e/teardown.ts',
  webServer: [
    {
      command: 'corepack pnpm --filter @solution/api build && node apps/api/dist/src/main.js',
      url: 'http://localhost:3000/api/v1/health/ready',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: `corepack pnpm --filter @solution/web dev --port ${webPort}`,
      url: webOrigin,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
});
