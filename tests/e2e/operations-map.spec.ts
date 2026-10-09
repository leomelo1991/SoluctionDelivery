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
test('admin and establishment share a scoped map; browser courier sends GPS and disappears offline', async ({
  page,
  browser,
}) => {
  let googleRequests = 0;
  page.on('request', (request) => {
    if (/maps\.googleapis|maps\.gstatic/.test(request.url())) googleRequests++;
  });
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhXcAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await login(page, 'admin@example.test');
  const tileRequest = page.waitForRequest((request) =>
    request.url().startsWith('https://tile.openstreetmap.org/'),
  );
  await page.getByRole('link', { name: 'Mapa da operação' }).click();
  await tileRequest;
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'OpenStreetMap', exact: true })).toBeVisible();
  expect(googleRequests).toBe(0);
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
  await expect(page.locator('.leaflet-marker-icon[title="Entregador um"]')).toBeVisible();
  const shop = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await shop.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await login(shop, 'loja@example.test');
  await shop.goto('/estabelecimento/mapa');
  await expect(shop.getByText('Loja de testes', { exact: true })).toBeVisible();
  await expect(shop.getByText(/Não foi possível carregar o fundo do mapa/)).toBeVisible();
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

test('operation map draws a clearly marked connection and a street route for the selected delivery', async ({
  page,
}) => {
  await login(page, 'admin@example.test');
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  const id = '00000000-0000-4000-8000-000000000001';
  await page.route('**/api/v1/operations-map', (route) =>
    route.fulfill({
      json: {
        generatedAt: new Date().toISOString(),
        geocodingEnabled: false,
        truncated: false,
        couriers: [],
        pins: [
          {
            id: `pickup:${id}`,
            deliveryId: id,
            kind: 'pickup',
            label: 'Coleta #540',
            address: 'CEP de Franca — demonstração',
            active: false,
            approximate: true,
            locationStatus: 'ready',
            point: { latitude: -20.54, longitude: -47.4 },
          },
          {
            id: `dropoff:${id}`,
            deliveryId: id,
            kind: 'dropoff',
            label: 'Entrega #540',
            address: 'CEP de Franca — demonstração',
            active: true,
            approximate: true,
            locationStatus: 'ready',
            point: { latitude: -20.55, longitude: -47.41 },
          },
        ],
      },
    }),
  );
  let road = false;
  await page.route(`**/api/v1/operations-map/routes/${id}`, (route) =>
    route.fulfill({
      json: {
        deliveryId: id,
        version: 1,
        kind: road ? 'road' : 'connection',
        coordinates: [
          { latitude: -20.54, longitude: -47.4 },
          { latitude: -20.54, longitude: -47.41 },
          { latitude: -20.55, longitude: -47.41 },
        ],
        notice: road
          ? 'Trajeto calculado pelo openrouteservice.'
          : 'Ligação aproximada entre os pontos; não representa o trajeto pelas ruas.',
        approximate: true,
        origin: 'Local de coleta — percurso previsto',
        distanceM: road ? 2000 : null,
      },
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/mapa');
  await expect(page.getByLabel('Entrega no mapa')).toHaveValue(id);
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveAttribute(
    'stroke-dasharray',
    '10 10',
  );
  await expect(
    page.getByText(/Ligação aproximada entre os pontos; não representa/).first(),
  ).toBeVisible();
  road = true;
  await page.getByRole('button', { name: 'Atualizar trajeto' }).click();
  await expect(page.getByText(/Trajeto calculado pelo openrouteservice/).first()).toBeVisible();
  await expect(page.locator('.leaflet-overlay-pane path')).not.toHaveAttribute('stroke-dasharray');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
});
