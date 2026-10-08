import { test, expect } from './test';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
test('admin layout and financial dialogs work from small phones to wide desktops without mandatory reasons', async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const f = JSON.parse(readFileSync('test-results/fixture.json', 'utf8'));
  await page.goto('/login');
  await page.getByLabel('Identificador da empresa').fill(f.tenant.slug);
  await page.getByLabel('E-mail', { exact: true }).fill(f.admin.email);
  await page.getByLabel('Senha', { exact: true }).fill('Fixture-Password-2026!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sair da conta' })).toBeVisible();
  await page.evaluate(async (storeId) => {
    const me = await fetch('/api/v1/me').then((r) => r.json());
    const status = await fetch('/api/v1/finance/status').then((r) => r.json());
    const post = async (path: string, body: object) => {
      const response = await fetch('/api/v1/finance' + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': me.csrfToken,
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await response.text());
    };
    if (!status.enabled) await post('/enable', {});
    await post(`/wallets/${storeId}`, { enabled: true });
  }, f.store.id);
  mkdirSync('/tmp/ui-review', { recursive: true });
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : width === 1024 ? 768 : 1000 });
    for (const path of [
      '/admin',
      '/admin/financeiro',
      '/admin/contratos',
      '/admin/estabelecimentos',
    ]) {
      await page.goto(path);
      await expect(page.locator('main h1').first()).toBeVisible();
      if (path.endsWith('estabelecimentos')) {
        const card = page.locator('.directory-card').filter({ hasText: 'Loja de testes' });
        await expect(card.getByRole('heading', { name: 'Loja de testes' })).toBeVisible();
        const button = card.getByRole('button', { name: 'Ver perfil', exact: true });
        const bounds = await button.boundingBox();
        expect(bounds!.width).toBeGreaterThan(120);
        expect(bounds!.height).toBeLessThan(70);
        await button.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page
          .getByRole('dialog')
          .getByRole('button', { name: /Fechar/ })
          .click();
        await expect(button).toBeFocused();
        const skip = page.getByRole('link', { name: 'Ir para o conteúdo' });
        await expect(skip).toHaveCSS('clip-path', 'inset(50%)');
        await page.screenshot({ path: `/tmp/ui-review/directory-${width}.png`, fullPage: true });
        if (width === 390) {
          await page.goto(path);
          await expect(page.locator('main h1')).toBeVisible();
          await page.keyboard.press('Tab');
          await expect(skip).toBeFocused();
          await expect(skip).toHaveCSS('clip-path', 'none');
          await page.keyboard.press('Enter');
          await expect(page.locator('#main-content')).toBeFocused();
        }
      }
      if (path.endsWith('financeiro')) {
        await page.getByLabel('Estabelecimento', { exact: true }).selectOption(f.store.id);
        await expect(
          page.getByRole('heading', { name: 'Loja de testes', exact: true }),
        ).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Reservas', exact: true })).toBeVisible();
        await expect(page.getByLabel(/Justificativa/)).toHaveCount(0);
        await page.screenshot({ path: `/tmp/ui-review/finance-${width}.png`, fullPage: true });
        if (width === 390) {
          await page.getByLabel('Tema da interface').selectOption('dark');
          await page.screenshot({ path: '/tmp/ui-review/finance-390-dark.png', fullPage: true });
          await page.getByLabel('Tema da interface').selectOption('light');
        }
        await page.getByRole('button', { name: 'Simular crédito', exact: true }).click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        await expect(modal.getByLabel(/Justificativa|Referência única/)).toHaveCount(0);
        await modal.getByLabel('Valor fictício (R$)').fill('123.45');
        const box = await modal.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        for (const field of await modal.locator('input, select').all()) {
          const bounds = await field.boundingBox();
          expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
        }
        await modal.getByRole('button', { name: /Fechar/ }).click();
      }
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
    }
    if (width < 1024) {
      await page.getByRole('button', { name: 'Abrir menu' }).click();
      await expect(page.getByRole('link', { name: 'Financeiro', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Fechar menu', exact: true }).click();
    }
  }
  const shop = await browser.newPage();
  await shop.goto('/login');
  await shop.getByLabel('Identificador da empresa').fill(f.tenant.slug);
  await shop.getByLabel('E-mail', { exact: true }).fill(f.operator.email);
  await shop.getByLabel('Senha', { exact: true }).fill('Fixture-Password-2026!');
  await shop.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(shop.getByRole('button', { name: 'Sair da conta' })).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await shop.setViewportSize({ width, height: 844 });
    for (const route of [
      '/estabelecimento/financeiro',
      '/estabelecimento/contratos',
      '/estabelecimento/entregas',
    ]) {
      await shop.goto(route);
      await expect(shop.locator('main h1').first()).toBeVisible();
      await expect
        .poll(() => shop.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
    }
  }
  await shop.close();
});
