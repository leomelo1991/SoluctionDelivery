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
test('CRM proposes a budget; establishment accepts; CRM reserves a courier', async ({
  page,
  browser,
}) => {
  await login(page, 'admin@example.test');
  await page.goto('/admin/contratos');
  await page.getByRole('button', { name: 'Novo contrato', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome do contrato').fill('Plano semanal Franca E2E');
  await dialog.getByLabel('Estabelecimento', { exact: true }).click();
  await dialog.getByRole('option', { name: fixture().store.name, exact: true }).click();
  await dialog.getByLabel('Vigência: início (São Paulo)').fill('2030-01-01T00:00');
  await dialog.getByLabel('Vigência: fim exclusivo (São Paulo)').fill('2030-02-01T00:00');
  await dialog.getByLabel('Área de atendimento').fill('Franca–SP, Centro e Estação');
  await dialog
    .getByLabel('Condições de presença')
    .fill('Presença integral; faltas e substituições são registradas pelo gestor.');
  await dialog.getByLabel('Disponibilidade mínima semanal').fill('600');
  await dialog.getByLabel('Parcela variável por entrega').fill('2');
  await dialog.getByLabel('Fixo ou garantia').fill('50');
  await dialog.getByLabel('Volume do turno 1').fill('100');
  await dialog.getByRole('button', { name: 'Calcular orçamento' }).click();
  await expect(dialog.getByText('R$ 800,00', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Salvar rascunho calculado' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Enviar proposta e fixar condições' }).click();
  await expect(page.getByText('Versão 1 · Aguardando aceite', { exact: true })).toBeVisible();
  const shop = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await login(shop, 'loja@example.test');
  await shop.goto('/estabelecimento/contratos');
  await expect(shop.getByText('Plano semanal Franca E2E', { exact: true })).toBeVisible();
  await expect(shop.getByText('Remuneração estimada', { exact: true })).toHaveCount(0);
  await shop.getByRole('button', { name: 'Aceitar proposta', exact: true }).click();
  await shop
    .getByLabel('Declaração de aceite das condições acima')
    .fill('Concordo com os turnos e os valores propostos.');
  await shop.getByRole('dialog').getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(shop.getByText('Versão 1 · Aceito', { exact: true })).toBeVisible();
  await expect(shop.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.reload();
  await page.getByRole('button', { name: 'Agendar turno', exact: true }).click();
  await dialog.getByLabel('Turno do contrato').selectOption('0');
  await dialog.getByLabel('Data e hora de início').fill('2030-01-07T18:00');
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Escala e presença', exact: true }).click();
  await page.getByRole('button', { name: 'Alocar entregador', exact: true }).click();
  await dialog.getByLabel('Entregador aprovado', { exact: true }).click();
  await dialog.getByRole('option', { name: 'Entregador um', exact: true }).click();
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Vaga 1 · Entregador um', { exact: true })).toBeVisible();
  await shop.getByRole('button', { name: 'Escala e presença', exact: true }).click();
  await expect(shop.getByText('Vaga 1 · Entregador um', { exact: true })).toBeVisible();
  await expect(shop.getByRole('button', { name: 'Alocar entregador', exact: true })).toHaveCount(0);
  await shop.close();
});
