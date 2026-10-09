import { test, expect, type Page } from './test';
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
test('financial sandbox activates, confirms credits, reserves a week and shows scoped statement on mobile', async ({
  page,
  browser,
}) => {
  await login(page, 'admin@example.test');
  await page.getByRole('link', { name: 'Financeiro', exact: true }).click();
  await page.getByRole('button', { name: 'Habilitar simulação financeira' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Habilitar simulação', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel('Estabelecimento', { exact: true }).click();
  await page.getByRole('option', { name: fixture().store.name, exact: true }).click();
  await page.getByRole('button', { name: 'Ativar carteira de simulação' }).click();
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Simular crédito', exact: true }).click();
  await dialog.getByLabel('Valor fictício (R$)').fill('800');
  await dialog.getByLabel('Resultado simulado').selectOption('approve');
  await dialog.getByRole('button', { name: 'Criar crédito simulado' }).click();
  await page.getByRole('button', { name: 'Processar simulações pendentes' }).click();
  await expect(page.getByText('Crédito simulado confirmado', { exact: true })).toBeVisible();
  const versionId = await page.evaluate(async (storeId) => {
    const me = await fetch('/api/v1/me').then((r) => r.json());
    const post = async (path: string, body: object) => {
      const r = await fetch('/api/v1' + path, {
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
    const c = await post('/contracts', {
      title: 'Contrato teste financeiro',
      establishmentId: storeId,
      effectiveFrom: '2031-01-01T03:00:00Z',
      effectiveTo: '2031-02-01T03:00:00Z',
      terms: {
        timezone: 'America/Sao_Paulo',
        coverage: 'Franca-SP',
        servicePolicy: 'Presença e substituição documentadas',
        weeklyAvailabilityCents: 60000,
        platformFeeCents: 0,
        deliveryFeeCents: 200,
        payModel: 'fixed',
        courierFixedCents: 5000,
        courierDeliveryCents: 0,
        templates: [
          {
            weekday: 1,
            startMinute: 1080,
            endMinute: 1380,
            courierCount: 2,
            expectedDeliveries: 100,
          },
        ],
      },
    });
    await post(`/contract-versions/${c.version.id}/propose`, { revision: 1 });
    await post(`/contract-versions/${c.version.id}/accept`, {
      revision: 2,
      evidence: 'Aceite documentado para teste financeiro',
    });
    return c.version.id;
  }, fixture().store.id);
  await page.getByRole('button', { name: 'Reservar mínimo semanal' }).click();
  await dialog.getByLabel('Versão aceita').selectOption(versionId);
  await dialog.getByLabel('Segunda-feira (AAAA-MM-DD)').fill('2031-01-06');
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('dd').filter({ hasText: 'R$ 600,00' })).toBeVisible();
  await expect(page.locator('dd').filter({ hasText: 'R$ 200,00' })).toBeVisible();
  const shop = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await login(shop, 'loja@example.test');
  await shop.goto('/estabelecimento/financeiro');
  await expect(shop.getByRole('heading', { name: 'Loja de testes' })).toBeVisible();
  await expect(shop.locator('dd').filter({ hasText: 'R$ 200,00' })).toBeVisible();
  await expect(shop.getByRole('button', { name: 'Simular crédito', exact: true })).toHaveCount(0);
  await expect(shop.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.getByRole('button', { name: 'Encerrar reserva simulada' }).click();
  await dialog.getByLabel('Consumo fictício (R$)').fill('520');
  await dialog.getByRole('button', { name: 'Confirmar encerramento simulado' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(shop.locator('dd').filter({ hasText: 'R$ 280,00' })).toBeVisible();
  await expect(
    shop.getByText('Liberação do valor não consumido (simulação)', { exact: true }),
  ).toBeVisible();
  await shop.close();
});
