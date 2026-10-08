import { test, expect, type Page } from './test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const fixture = () => JSON.parse(readFileSync('test-results/settlement-fixture.json', 'utf8'));
const fixtureCommand = (args: string[] = []) =>
  execFileSync(
    'corepack',
    [
      'pnpm',
      '--filter',
      '@solution/api',
      'exec',
      'tsx',
      'scripts/e2e-finance-settlement.ts',
      ...args,
    ],
    { stdio: 'pipe' },
  );
test.beforeAll(() => fixtureCommand());
test.afterAll(() => fixtureCommand(['cleanup']));
async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Identificador da empresa').fill(fixture().tenant.slug);
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('Fixture-Password-2026!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sair da conta' })).toBeVisible();
}
test('admin closes week and pays simulation; establishment and courier see their own financial results', async ({
  page,
  browser,
}) => {
  await login(page, fixture().admin.email);
  await page.evaluate(async (f) => {
    const me = await fetch('/api/v1/me').then((r) => r.json());
    const post = async (path: string, body: object) => {
      const r = await fetch('/api/v1/finance' + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': me.csrfToken,
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    };
    const reason = 'Preparação de fechamento para teste';
    await post('/enable', { reason });
    await post(`/wallets/${f.store.id}`, { enabled: true, reason });
    await post('/topups', {
      establishmentId: f.store.id,
      amountCents: '80000',
      reference: crypto.randomUUID(),
      scenario: 'approve',
      reason,
    });
    await post('/process', {});
    await post('/reservations/week', { versionId: f.version.id, week: '2026-09-07' });
  }, fixture());
  await page.goto('/admin/financeiro');
  await page.getByLabel('Estabelecimento', { exact: true }).selectOption(fixture().store.id);
  await page.getByRole('button', { name: 'Fechar semana simulada' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Versão aceita').selectOption(fixture().version.id);
  await dialog.getByLabel('Segunda-feira (AAAA-MM-DD)').fill('2026-09-07');
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Conferência contábil sem divergências.')).toBeVisible();
  await expect(page.getByText('Devido no simulador', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Simular repasse', exact: true }).click();
  await dialog.getByLabel('Resultado simulado').selectOption('approve');
  await dialog.getByRole('button', { name: 'Confirmar simulação' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Processar repasse simulado', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirmar simulação' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Simular devolução' })).toBeVisible();
  const shop = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await login(shop, fixture().operator.email);
  await shop.goto('/estabelecimento/financeiro');
  await expect(shop.getByText(/Crédito liberado: R\$ 80,00/)).toBeVisible();
  await expect(shop.getByRole('heading', { name: 'Ganhos e repasses simulados' })).toHaveCount(0);
  await expect(shop.locator('body')).toHaveJSProperty('scrollWidth', 390);
  const rider = await browser.newPage();
  await login(rider, fixture().courierUser.email);
  await rider.goto('/entregador/concluidas');
  await expect(rider.getByRole('heading', { name: 'Ganhos e repasses simulados' })).toBeVisible();
  await expect(rider.getByText('Pago no simulador', { exact: true }).first()).toBeVisible();
  await expect(rider.getByRole('button', { name: 'Simular devolução' })).toHaveCount(0);
  await shop.close();
  await rider.close();
});
