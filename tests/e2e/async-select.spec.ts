import { test, expect } from './test';
import { readFileSync } from 'node:fs';
test.use({ hasTouch: true });
test('search stays inside the selector; keyboard, clearing, paging and empty results work', async ({
  page,
}) => {
  const f = JSON.parse(readFileSync('test-results/fixture.json', 'utf8'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.getByLabel('Identificador da empresa').fill(f.tenant.slug);
  await page.getByLabel('E-mail', { exact: true }).fill(f.admin.email);
  await page.getByLabel('Senha', { exact: true }).fill('Fixture-Password-2026!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sair da conta' })).toBeVisible();
  await page.route('**/api/v1/establishments?**', async (route) => {
    const params = new URL(route.request().url()).searchParams;
    const q = params.get('q') ?? '';
    const current = Number(params.get('page') ?? 1);
    const all = Array.from({ length: 35 }, (_, i) => ({
      id: `store-${i}`,
      name: `Loja ${String(i + 1).padStart(2, '0')}`,
    })).filter((o) => o.name.toLowerCase().includes(q.toLowerCase()));
    await route.fulfill({
      json: {
        items: all.slice((current - 1) * 30, current * 30),
        total: all.length,
        page: current,
        pageSize: 30,
      },
    });
  });
  await page.goto('/admin/contratos');
  await page.getByRole('button', { name: 'Novo contrato', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const trigger = dialog.getByRole('button', { name: 'Estabelecimento', exact: true });
  const search = dialog.getByRole('combobox', { name: 'Buscar estabelecimento' });
  await expect(search).toHaveCount(0);
  await trigger.click();
  await expect(search).toBeFocused();
  await expect(
    dialog.getByRole('listbox', { name: 'Estabelecimento', exact: true }).getByRole('option'),
  ).toHaveCount(30);
  await dialog.getByRole('button', { name: 'Próxima', exact: true }).click();
  await expect(
    dialog.getByRole('listbox', { name: 'Estabelecimento', exact: true }).getByRole('option'),
  ).toHaveCount(5);
  await dialog.getByRole('option', { name: 'Loja 35', exact: true }).tap();
  await expect(trigger).toHaveText('Loja 35');
  await expect(trigger).toBeFocused();
  await expect(search).toHaveCount(0);
  await trigger.press('ArrowDown');
  await search.fill('inexistente');
  await expect(dialog.getByText('Nenhum resultado encontrado.')).toBeVisible();
  await expect(trigger).toHaveText('Loja 35');
  await search.fill('Loja 02');
  await expect(
    dialog.getByRole('listbox', { name: 'Estabelecimento', exact: true }).getByRole('option'),
  ).toHaveCount(1);
  await page.screenshot({ path: '/tmp/async-select-390.png' });
  await search.press('ArrowDown');
  await search.press('Enter');
  await expect(trigger).toHaveText('Loja 02');
  await expect(dialog).toBeVisible();
  await trigger.click();
  await search.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(search).toHaveCount(0);
  await trigger.click();
  await dialog.getByRole('button', { name: 'Limpar seleção' }).click();
  await expect(trigger).toHaveText('Selecione');
  await trigger.click();
  await dialog.getByLabel('Nome do contrato').click();
  await expect(search).toHaveCount(0);
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
