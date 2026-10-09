import { execFileSync } from 'node:child_process';
import { test, expect } from './test';
import { readFileSync } from 'node:fs';
test.afterEach(() => {
  const f = JSON.parse(readFileSync('test-results/fixture.json', 'utf8'));
  execFileSync(
    'corepack',
    [
      'pnpm',
      '--filter',
      '@solution/api',
      'exec',
      'tsx',
      'scripts/e2e-external-orders.ts',
      f.tenant.id,
    ],
    { stdio: 'pipe', env: { ...process.env, NODE_ENV: 'test' } },
  );
});

test('merchant receives a simulated order, reviews freight and creates one linked delivery', async ({
  page,
}) => {
  const f = JSON.parse(readFileSync('test-results/fixture.json', 'utf8'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.getByLabel('Identificador da empresa').fill(f.tenant.slug);
  await page.getByLabel('E-mail', { exact: true }).fill(f.operator.email);
  await page.getByLabel('Senha', { exact: true }).fill('Fixture-Password-2026!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sair da conta' })).toBeVisible();
  await page.goto('/estabelecimento/pedidos-externos');
  await expect(page.getByText('Modo demonstrativo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Simular pedido', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Origem simulada').selectOption('99food');
  await dialog.getByLabel('Referência do pedido').fill('DEMO-BROWSER');
  await dialog.getByRole('button', { name: 'Receber pedido demonstrativo' }).click();
  await expect(dialog).toHaveCount(0);
  const card = page.locator('.directory-card').filter({ hasText: 'DEMO-BROWSER' });
  await expect(card.getByText('99Food · Demonstração')).toBeVisible();
  await card.getByRole('button', { name: 'Revisar e criar entrega' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Nome do destinatário')).toHaveValue('Cliente demonstrativo');
  await dialog.getByLabel('Nome do destinatário').fill('Cliente demonstrativo do pedido');
  await dialog.getByLabel('Modalidade do frete').selectOption('region');
  await dialog.getByLabel('Região de destino (tarifa regional)').selectOption(f.region.id);
  await dialog.getByRole('button', { name: 'Calcular e revisar frete' }).click();
  await expect(dialog.getByText('Cotação pronta para confirmação')).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirmar e criar entrega' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(card.getByRole('button', { name: /Ver entrega #/ })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Revisar e criar entrega' })).toHaveCount(0);
  await page.reload();
  await expect(card.getByRole('button', { name: /Ver entrega #/ })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({ path: '/tmp/external-orders-390.png', fullPage: true });
});
