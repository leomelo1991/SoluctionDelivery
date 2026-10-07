import { expect, test, type Page } from '@playwright/test';

async function mockApi(page: Page) {
  let actor = 'admin-one';
  let submissions = 0;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    let data: unknown = { items: [], total: 0, page: 1, pageSize: 20 };
    if (path === '/me' || path === '/auth/login') {
      if (path === '/auth/login') actor = 'admin-two';
      data = {
        id: actor,
        tenantId: 'tenant-one',
        name: 'Administrador',
        role: 'admin',
        csrfToken: 'test-csrf',
        mustChangePassword: false,
        establishmentId: 'store-one',
      };
    } else if (path === '/pricing') {
      data = { regions: [] };
    } else if (path === '/dashboard') {
      data = {
        period: { from: new Date().toISOString(), to: new Date().toISOString() },
        active: 0,
        delivered: 0,
        activeFreightCents: 0,
        completedFreightCents: 0,
        establishments: [],
        couriers: [],
      };
    } else if (path === '/pricing/quotes') {
      data = {
        id: 'quote-one',
        feeCents: 1000,
        payoutCents: 800,
        distanceM: 4500,
        durationSeconds: null,
        provider: 'manual',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        snapshot: { baseFeeCents: 1000, basePayoutCents: 800, surcharges: [] },
      };
    } else if (path === '/couriers' && request.method() === 'POST') {
      submissions++;
      data = { id: 'created-courier', ...request.postDataJSON() };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
  return {
    submissions: () => submissions,
    setActor: (id: string) => {
      actor = id;
    },
  };
}

async function openCouriers(page: Page) {
  await page.goto('/admin/entregadores');
  await page.getByRole('button', { name: 'Novo entregador', exact: true }).click();
}

test('unfinished form survives closing, navigation and reload; success clears it', async ({
  page,
}) => {
  const { submissions } = await mockApi(page);
  await openCouriers(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome do entregador').fill('Rascunho preservado');
  await dialog.getByLabel('Telefone').fill('11999990000');
  await dialog.getByLabel('Veículo').selectOption('motorcycle');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Estabelecimentos', exact: true }).click();
  await page.getByRole('button', { name: 'Novo estabelecimento', exact: true }).click();
  await expect(dialog.getByLabel('Nome do estabelecimento')).toHaveValue('');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Entregadores', exact: true }).click();
  await page.getByRole('button', { name: 'Novo entregador', exact: true }).click();
  await expect(dialog.getByLabel('Nome do entregador')).toHaveValue('Rascunho preservado');
  await page.reload();
  await page.getByRole('button', { name: 'Novo entregador', exact: true }).click();
  await expect(dialog.getByLabel('Telefone')).toHaveValue('11999990000');
  await expect(dialog.getByLabel('Veículo')).toHaveValue('motorcycle');
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(submissions()).toBe(1);
  await page.getByRole('button', { name: 'Novo entregador', exact: true }).click();
  await expect(dialog.getByLabel('Nome do entregador')).toHaveValue('');
});

test('search and filters survive navigation and stay separate between directories', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/admin/entregadores');
  await page.getByLabel('Buscar cadastro').fill('Carlos');
  await page.getByLabel('Filtrar cadastro').selectOption('approved');
  await page.getByRole('link', { name: 'Estabelecimentos', exact: true }).click();
  await expect(page.getByLabel('Buscar cadastro')).toHaveValue('');
  await expect(page.getByLabel('Filtrar cadastro')).toHaveValue('');
  await page.getByRole('link', { name: 'Entregadores', exact: true }).click();
  await expect(page.getByLabel('Buscar cadastro')).toHaveValue('Carlos');
  await expect(page.getByLabel('Filtrar cadastro')).toHaveValue('approved');
});

test('passwords are excluded from drafts and logout clears session drafts', async ({ page }) => {
  await mockApi(page);
  await page.goto('/admin/usuarios');
  await page.getByRole('button', { name: 'Novo usuário', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome', { exact: true }).fill('Novo administrador');
  await dialog.getByLabel('Senha inicial (mínimo 12 caracteres)').fill('Private-Test-Password!');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Novo usuário', exact: true }).click();
  await expect(dialog.getByLabel('Nome', { exact: true })).toHaveValue('Novo administrador');
  await expect(dialog.getByLabel('Senha inicial (mínimo 12 caracteres)')).toHaveValue('');
  const stored = await page.evaluate(() => JSON.stringify(sessionStorage));
  expect(stored).not.toContain('Private-Test-Password!');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('sd-draft:'))),
    )
    .toEqual([]);
});

test('drafts remain usable when browser storage is restricted', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('Storage disabled');
    };
    Storage.prototype.setItem = () => {
      throw new Error('Storage disabled');
    };
  });
  await mockApi(page);
  await openCouriers(page);
  await page.getByLabel('Nome do entregador').fill('Rascunho em memória');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Estabelecimentos', exact: true }).click();
  await page.getByRole('link', { name: 'Entregadores', exact: true }).click();
  await page.getByRole('button', { name: 'Novo entregador', exact: true }).click();
  await expect(page.getByLabel('Nome do entregador')).toHaveValue('Rascunho em memória');
});

test('delivery draft keeps raw numeric values and survives quoting until creation succeeds', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/admin/entregas');
  await page.getByRole('button', { name: 'Nova entrega', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome do destinatário').fill('Destinatário preservado');
  await dialog.getByLabel('Telefone do destinatário').fill('11999990000');
  await dialog.getByLabel('Rua', { exact: true }).fill('Rua das Flores');
  await dialog.getByLabel('Número', { exact: true }).fill('125');
  await dialog.getByLabel('Bairro', { exact: true }).fill('Centro');
  await dialog.getByLabel('Cidade', { exact: true }).fill('São Paulo');
  await dialog.getByLabel('CEP', { exact: true }).fill('01001000');
  await dialog.getByLabel('Distância manual em km (opcional)').fill('4.5');
  await dialog.getByLabel('Justificativa para distância manual').fill('Percurso conferido');
  await dialog.getByRole('button', { name: 'Calcular e revisar frete' }).click();
  await expect(dialog.getByText('Cotação pronta para confirmação')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Estabelecimentos', exact: true }).click();
  await page.getByRole('link', { name: 'Entregas', exact: true }).click();
  await page.getByRole('button', { name: 'Nova entrega', exact: true }).click();
  await expect(dialog.getByLabel('Nome do destinatário')).toHaveValue('Destinatário preservado');
  await expect(dialog.getByLabel('Distância manual em km (opcional)')).toHaveValue('4.5');
  await expect(dialog.getByText('Cotação pronta para confirmação')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Calcular e revisar frete' }).click();
  await expect(dialog.getByText('Cotação pronta para confirmação')).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirmar e criar entrega' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Nova entrega', exact: true }).click();
  await expect(dialog.getByLabel('Nome do destinatário')).toHaveValue('');
});

test('a different user does not inherit another user draft', async ({ page }) => {
  const { setActor } = await mockApi(page);
  await openCouriers(page);
  await page.getByLabel('Nome do entregador').fill('Cadastro do primeiro usuário');
  await page.keyboard.press('Escape');
  setActor('admin-two');
  await page.reload();
  await page.getByRole('button', { name: 'Novo entregador', exact: true }).click();
  await expect(page.getByLabel('Nome do entregador')).toHaveValue('');
});

test('company and email survive leaving the login screen without persisting the password', async ({
  page,
}) => {
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Sessão ausente' }),
    }),
  );
  await page.goto('/login');
  await page.getByLabel('Identificador da empresa').fill('demo');
  await page.getByLabel('E-mail', { exact: true }).fill('courier@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('Private-Test-Password!');
  await page.getByRole('link', { name: 'Privacidade', exact: true }).click();
  await page.getByRole('link', { name: 'Voltar ao acesso', exact: true }).click();
  await expect(page.getByLabel('Identificador da empresa')).toHaveValue('demo');
  await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue('courier@example.test');
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('');
});

test('administrative correction reason survives closing and returning to delivery details', async ({
  page,
}) => {
  await mockApi(page);
  const address = {
    street: 'Rua das Flores',
    number: '125',
    district: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01001000',
  };
  const delivery = {
    id: 'delivery-one',
    createdAt: new Date().toISOString(),
    code: 1,
    version: 1,
    status: 'accepted',
    recipientName: 'Destinatário',
    recipientPhone: '11999990000',
    establishment: { id: 'store-one', name: 'Loja' },
    pickupAddress: address,
    destinationAddress: address,
    feeCents: 1000,
    courierPayoutCents: 800,
    manualDistanceM: null,
    events: [],
  };
  await page.route('**/api/v1/deliveries**', (route) => {
    const isDetail = new URL(route.request().url()).pathname.endsWith('/delivery-one');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        isDetail ? delivery : { items: [delivery], total: 1, page: 1, pageSize: 30 },
      ),
    });
  });
  await page.goto('/admin/entregas');
  await page.getByRole('button', { name: 'Detalhes', exact: true }).click();
  await page
    .getByLabel('Motivo da correção administrativa')
    .fill('Correção conferida pelo operador');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Estabelecimentos', exact: true }).click();
  await page.getByRole('link', { name: 'Entregas', exact: true }).click();
  await page.getByRole('button', { name: 'Detalhes', exact: true }).click();
  await expect(page.getByLabel('Motivo da correção administrativa')).toHaveValue(
    'Correção conferida pelo operador',
  );
});
