import { test, expect, type Page } from './test';
import { readFileSync } from 'node:fs';
const fixture = () => JSON.parse(readFileSync('test-results/fixture.json', 'utf8'));
async function login(page: Page, email: string, password = 'Fixture-Password-2026!') {
  await page.goto('/login');
  await page.getByLabel('Identificador da empresa').fill(fixture().tenant.slug);
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

async function verifyDraftOnReturn(page: Page, endpoint: string, check: () => Promise<void>) {
  async function visibility(state: 'hidden' | 'visible') {
    await page.evaluate((value) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
      window.dispatchEvent(new Event(value === 'visible' ? 'focus' : 'blur'));
    }, state);
  }
  // Mark the cached query stale before returning to the window.
  await visibility('hidden');
  await page.waitForTimeout(3200);
  const refreshed = page.waitForResponse(
    (response) => response.url().includes(endpoint.replace('*', '')) && response.status() === 200,
  );
  await visibility('visible');
  await refreshed;
  await check();
  await page.route('**' + endpoint, (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Falha temporária de teste' }),
    }),
  );
  try {
    await visibility('hidden');
    await page.waitForTimeout(3200);
    const failed = page.waitForResponse(
      (response) => response.url().includes(endpoint.replace('*', '')) && response.status() === 503,
    );
    await visibility('visible');
    await failed;
    await expect(
      page.locator('[role="alert"]').filter({ hasText: 'Falha temporária de teste' }).first(),
    ).toBeVisible();
    await check();
  } finally {
    await page.unroute('**' + endpoint);
  }
  await visibility('hidden');
  await page.waitForTimeout(3200);
  const recovered = page.waitForResponse(
    (response) => response.url().includes(endpoint.replace('*', '')) && response.status() === 200,
  );
  await visibility('visible');
  await recovered;
  await expect(
    page.locator('[role="alert"]').filter({ hasText: 'Falha temporária de teste' }),
  ).toHaveCount(0);
  await check();
}

test('integrated delivery persists across establishment, courier and CRM sessions', async ({
  browser,
}) => {
  const storeContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const courierContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const store = await storeContext.newPage();
  const admin = await adminContext.newPage();
  const courier = await courierContext.newPage();
  await login(store, 'loja@example.test');
  await expect(store.getByRole('heading', { name: 'Gestão de entregas' })).toBeVisible();
  await login(admin, 'admin@example.test');
  await expect(admin.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  await login(courier, 'entregador@example.test');
  await expect(courier.getByRole('heading', { name: /Olá/ })).toBeVisible();
  await store.getByRole('button', { name: 'Nova entrega' }).click();
  const form = store.getByRole('dialog');
  await form.getByLabel('Nome do destinatário').fill('Cliente da jornada');
  await verifyDraftOnReturn(store, '/api/v1/me', async () => {
    await expect(form.getByLabel('Nome do destinatário')).toHaveValue('Cliente da jornada');
    await expect(form).toBeVisible();
  });
  await form.getByLabel('Telefone do destinatário').fill('11999990009');
  await form.getByLabel('Rua', { exact: true }).fill('Rua das Flores');
  await form.getByLabel('Número', { exact: true }).fill('125');
  await form.getByLabel('Bairro', { exact: true }).fill('Centro');
  await form.getByLabel('Cidade', { exact: true }).fill('São Paulo');
  await form.getByLabel('CEP', { exact: true }).fill('01001000');
  await form.getByLabel('Modalidade do frete').selectOption('region');
  await form.getByLabel('Região de destino (tarifa regional)').selectOption(fixture().region.id);
  await form.getByRole('button', { name: 'Calcular e revisar frete' }).click();
  await expect(form.getByText('Cotação pronta para confirmação')).toBeVisible();
  await form.getByRole('button', { name: 'Confirmar e criar entrega' }).click();
  await expect(store.getByRole('dialog')).toHaveCount(0);
  await expect(store.getByText('Cliente da jornada', { exact: true })).toBeVisible();
  await admin.reload();
  await expect(admin.getByText('Cliente da jornada', { exact: true })).toBeVisible();
  await courier.reload();
  await expect(courier.getByRole('button', { name: 'Aceitar entrega', exact: true })).toBeVisible();
  await expect(courier.getByText('Cliente da jornada', { exact: true })).toHaveCount(0);
  await courier.getByRole('button', { name: 'Aceitar entrega', exact: true }).click();
  await courier.getByRole('button', { name: 'Confirmar aceite' }).click();
  let detail = courier.getByRole('dialog');
  await expect(detail.getByRole('button', { name: 'Cheguei ao estabelecimento' })).toBeVisible();
  await detail.getByRole('button', { name: 'Cheguei ao estabelecimento' }).click();
  await expect(detail.getByRole('button', { name: 'Confirmar retirada' })).toBeVisible();
  await detail.getByRole('button', { name: 'Confirmar retirada' }).click();
  await expect(
    detail.getByRole('button', { name: 'Confirmar entrega', exact: true }),
  ).toBeVisible();
  await detail.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
  await expect(detail.getByText('Entregue', { exact: true }).first()).toBeVisible();
  await detail.getByRole('button', { name: 'Fechar diálogo' }).click();
  await store.reload();
  await store.getByRole('button', { name: 'Concluídas', exact: true }).click();
  await expect(store.getByText('Cliente da jornada', { exact: true })).toBeVisible();
  await courier.getByRole('link', { name: 'Concluídas', exact: true }).click();
  await expect(
    courier.getByText('Somatório previsto; não é saldo nem pagamento realizado.'),
  ).toBeVisible();
  expect(
    await courier.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await admin.getByLabel('Tema da interface').selectOption('dark');
  await expect(admin.locator('html')).toHaveAttribute('data-theme', 'dark');
  await admin.reload();
  await expect(admin.locator('html')).toHaveAttribute('data-theme', 'dark');
  await admin.getByLabel('Tema da interface').selectOption('light');
  await expect(admin.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  await expect(admin.getByText('R$ 10,00', { exact: true })).toBeVisible();
  await expect(
    admin.getByRole('status').filter({ hasText: 'Carregando informações…' }),
  ).toHaveCount(0);
  await expect(
    courier.getByRole('status').filter({ hasText: 'Alteração confirmada.' }),
  ).toHaveCount(0);
  await admin.screenshot({ path: 'test-results/admin-desktop.png', fullPage: true });
  await courier.screenshot({ path: 'test-results/courier-mobile.png', fullPage: true });
  await store.screenshot({ path: 'test-results/establishment-desktop.png', fullPage: true });
  await storeContext.close();
  await courierContext.close();
  await adminContext.close();
});
test('CRM notes render safely and keyboard opens and closes profile', async ({ page }) => {
  await login(page, 'admin@example.test');
  await page.getByRole('link', { name: 'Estabelecimentos', exact: true }).click();
  await page.getByRole('button', { name: 'Ver perfil' }).first().focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Editar cadastro', exact: true }).click();
  const responsible = dialog.getByLabel('Responsável', { exact: true });
  await responsible.fill('Rascunho do CRM');
  await verifyDraftOnReturn(page, '/api/v1/me', async () => {
    await expect(responsible).toHaveValue('Rascunho do CRM');
    await expect(dialog).toBeVisible();
  });
  await verifyDraftOnReturn(page, '/api/v1/establishments/*', async () => {
    await expect(responsible).toHaveValue('Rascunho do CRM');
  });
  await dialog.getByRole('button', { name: 'Fechar edição', exact: true }).click();
  await dialog.getByLabel('Nova anotação').fill('<script>window.attacked=true</script>');
  await dialog.getByRole('button', { name: 'Registrar nota' }).click();
  await expect(
    dialog.getByText('<script>window.attacked=true</script>', { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => Object.hasOwn(window, 'attacked'))).toBe(false);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ver perfil' }).first()).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page.getByRole('button', { name: 'Abrir menu' });
  await menu.click();
  await expect(page.getByRole('button', { name: 'Fechar menu' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
});

test('pricing forms apply distance formula and cumulative surcharge to the quote', async ({
  browser,
}) => {
  const adminContext = await browser.newContext();
  const storeContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const store = await storeContext.newPage();
  await login(admin, 'admin@example.test');
  await admin.getByRole('link', { name: 'Fretes e condições', exact: true }).click();
  await admin.getByRole('button', { name: 'Novo acréscimo' }).click();
  const extra = admin.getByRole('dialog');
  await extra.getByLabel('Nome da condição').fill('Chuva');
  await verifyDraftOnReturn(admin, '/api/v1/pricing', async () => {
    await expect(extra.getByLabel('Nome da condição')).toHaveValue('Chuva');
    await expect(extra).toBeVisible();
  });
  await extra.getByLabel('Motivo', { exact: true }).fill('Chuva intensa na região');
  await extra.getByLabel('Adicional na cobrança (R$)').fill('2');
  await extra.getByLabel('Adicional na cobrança (%)').fill('10');
  await extra.getByLabel('Adicional na remuneração (R$)').fill('1');
  await extra.getByLabel('Adicional na remuneração (%)').fill('20');
  await extra.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(extra).toHaveCount(0);
  await expect(admin.getByText('Em vigor', { exact: true })).toBeVisible();
  await login(store, 'loja@example.test');
  await store.getByRole('button', { name: 'Nova entrega' }).click();
  const form = store.getByRole('dialog');
  await form.getByLabel('Nome do destinatário').fill('Cliente do frete');
  await form.getByLabel('Telefone do destinatário').fill('11999990009');
  await form.getByLabel('Rua', { exact: true }).fill('Rua das Flores');
  await form.getByLabel('Número', { exact: true }).fill('130');
  await form.getByLabel('Bairro', { exact: true }).fill('Centro');
  await form.getByLabel('Cidade', { exact: true }).fill('São Paulo');
  await form.getByLabel('CEP', { exact: true }).fill('01001000');
  await form.getByLabel('Distância manual em km (opcional)').fill('4.5');
  await form
    .getByLabel('Justificativa para distância manual')
    .fill('Percurso conferido pelo operador');
  await form.getByRole('button', { name: 'Calcular e revisar frete' }).click();
  await expect(form.getByText('R$ 15,20', { exact: true })).toBeVisible();
  await expect(form.getByText('R$ 12,10', { exact: true })).toBeVisible();
  await form.getByRole('button', { name: 'Confirmar e criar entrega' }).click();
  await expect(form).toHaveCount(0);
  await expect(store.getByText('Cliente do frete', { exact: true })).toBeVisible();
  await adminContext.close();
  await storeContext.close();
});

test('expired session returns to login and clears the previous profile', async ({ page }) => {
  await login(page, 'admin@example.test');
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  await page.context().clearCookies();
  await page.getByRole('link', { name: 'Entregadores', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Entre na sua operação' })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'loja@example.test');
  await expect(page.getByRole('heading', { name: 'Gestão de entregas' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Usuários', exact: true })).toHaveCount(0);
});

test('initial password gate requires change and preserves password whitespace', async ({
  page,
}) => {
  await login(page, 'admin@example.test');
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  const adminMe = await (await page.request.get('/api/v1/me')).json();
  const temporary = 'Temporary-Test-2026!';
  const reset = await page.request.post(`/api/v1/users/${fixture().secondUser.id}/reset-password`, {
    headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': adminMe.csrfToken },
    data: { temporaryPassword: temporary },
  });
  expect(reset.status()).toBe(201);
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page.getByRole('heading', { name: 'Entre na sua operação' })).toBeVisible();
  await login(page, 'segundo@example.test', temporary);
  await expect(page.getByRole('heading', { name: 'Defina sua senha pessoal' })).toBeVisible();
  const blocked = await page.request.get('/api/v1/couriers/me');
  expect(blocked.status()).toBe(403);
  const privatePassword = '  Private-Test-Password-2026!  ';
  await page.getByLabel('Senha inicial', { exact: true }).fill(temporary);
  await page.getByLabel('Nova senha (mínimo 12 caracteres)').fill(privatePassword);
  await page.getByRole('button', { name: 'Alterar senha e continuar' }).click();
  await expect(page.getByRole('heading', { name: /Olá/ })).toBeVisible();
  const me = await (await page.request.get('/api/v1/me')).json();
  const wrong = await page.request.post('/api/v1/auth/password', {
    headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': me.csrfToken },
    data: { currentPassword: privatePassword.trim(), newPassword: 'Another-Private-2026!' },
  });
  expect(wrong.status()).toBe(403);
  expect((await wrong.json()).code).toBe('INVALID_PASSWORD');
});
