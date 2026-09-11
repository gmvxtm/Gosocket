import { test, expect } from '@playwright/test';
import { backendToken, backendUrl, createRequest, signIn } from './support';

test('creates locally, synchronizes and displays the confirmed request', async ({ page, request }, testInfo) => {
  const name = 'E2E ' + testInfo.project.name + ' ' + Date.now();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await signIn(page);
  await createRequest(page, name, 'hello gosocket');

  const detail = page.locator('.detail-panel');
  await expect(detail).toContainText('Pendiente');
  const id = await detail.locator('dt').filter({ hasText: /^Id$/ }).locator('+ dd').textContent();

  // The status screen is the one that answers what is pending and what was already sent.
  await page.getByRole('link', { name: 'Estado' }).click();
  await expect(page.locator('.counter-card.pending')).toContainText('Pendientes de envio');
  await page.getByRole('button', { name: 'Sincronizar' }).click();
  await expect(page.getByRole('status')).toContainText('Ultima sincronizacion', { timeout: 25000 });

  await page.getByRole('link', { name: 'Solicitudes', exact: true }).click();
  const row = page.getByRole('button', { name: new RegExp(name) });
  await expect(row).toContainText('Enviada');

  // What reached the central registry is the processed payload, not the local one.
  const token = await backendToken(request);
  const response = await request.get(backendUrl + '/requests/' + id, {
    headers: { authorization: 'Bearer ' + token }
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ id, payload: 'HELLO GOSOCKET', status: 'Processed' });

  await page.reload();
  await expect(page.getByRole('button', { name: new RegExp(name) })).toContainText('Enviada');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);

  const screenshot = testInfo.outputPath('requests.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('requests', { path: screenshot, contentType: 'image/png' });
});

test('the list filters by status and opens a detail by its own address', async ({ page }, testInfo) => {
  const name = 'Filtro ' + testInfo.project.name + ' ' + Date.now();

  await signIn(page);
  await createRequest(page, name, 'contenido de prueba');

  await page.getByRole('link', { name: 'Solicitudes', exact: true }).click();
  await page.getByLabel('Buscar por nombre').fill(name);
  const row = page.getByRole('button', { name: new RegExp(name) });
  await expect(row).toBeVisible();

  await page.getByLabel('Filtrar por estado').selectOption('Processed');
  await expect(row).toBeHidden();

  await page.getByLabel('Filtrar por estado').selectOption('Pending');
  await row.click();

  // The detail has its own URL, so it survives a reload.
  await expect(page).toHaveURL(/\/requests\/[0-9a-f-]{36}$/);
  await page.reload();
  await expect(page.locator('.detail-panel')).toContainText(name);
});
