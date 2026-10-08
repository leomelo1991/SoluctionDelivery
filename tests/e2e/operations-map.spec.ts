import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixture = () => JSON.parse(readFileSync('test-results/fixture.json', 'utf8'));
async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Identificador da empresa').fill(fixture().tenant.slug);
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('Fixture-Password-2026!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sair da conta' })).toBeVisible();
}
test('admin and establishment share a scoped map; browser courier sends GPS and disappears offline', async ({
  page,
  browser,
}) => {
  await login(page, 'admin@example.test');
  await page.getByRole('link', { name: 'Mapa da operação' }).click();
  await expect(page.getByRole('heading', { name: 'Mapa da operação', exact: true })).toBeVisible();
  await expect(page.getByText('Outra loja', { exact: true })).toBeVisible();
  const context = await browser.newContext({
    geolocation: { latitude: -20.54, longitude: -47.4 },
    permissions: ['geolocation'],
  });
  const rider = await context.newPage();
  await login(rider, 'entregador@example.test');
  await expect(
    rider.getByText('GPS compartilhado com a operação enquanto esta tela está visível.'),
  ).toBeVisible();
  await expect(page.getByText('1 entregadores com GPS recente', { exact: true })).toBeVisible();
  const shop = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await login(shop, 'loja@example.test');
  await shop.goto('/estabelecimento/mapa');
  await expect(shop.getByText('Loja de testes', { exact: true })).toBeVisible();
  await expect(shop.getByText('Outra loja', { exact: true })).toHaveCount(0);
  await expect(shop.getByText('0 entregadores com GPS recente', { exact: true })).toBeVisible();
  await expect(shop.locator('body')).toHaveJSProperty('scrollWidth', 390);
  // API de disponibilidade real: o mapa remove o GPS sem esperar os 30 segundos de expiração.
  await rider.evaluate(async () => {
    const me = await fetch('/api/v1/me').then((r) => r.json());
    const response = await fetch('/api/v1/couriers/me/availability', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken },
      body: JSON.stringify({ status: 'offline' }),
    });
    if (!response.ok) throw new Error('Falha ao ficar offline');
  });
  await expect(page.getByText('0 entregadores com GPS recente', { exact: true })).toBeVisible();
  await context.close();
  await shop.close();
});
