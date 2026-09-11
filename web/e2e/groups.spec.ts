import { test, expect } from '@playwright/test';
import { backendToken, backendUrl, createRequest, signIn } from './support';

test('groups nest, report their total and synchronize as a unit', async ({ page, request }, testInfo) => {
  const stamp = testInfo.project.name + ' ' + Date.now();
  const first = 'Child A ' + stamp;
  const second = 'Child B ' + stamp;
  const third = 'Parent own ' + stamp;
  const childGroup = 'Child group ' + stamp;
  const parentGroup = 'Parent group ' + stamp;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await signIn(page);
  await createRequest(page, first, 'alpha');
  await createRequest(page, second, 'beta');
  await createRequest(page, third, 'gamma');

  await page.getByRole('link', { name: 'Agrupaciones' }).click();
  const groups = page.locator('.group-panel');
  await expect(groups.getByRole('heading', { name: 'Agrupaciones' })).toBeVisible();

  // A group holding two requests.
  await groups.getByLabel('Nombre del grupo').fill(childGroup);
  await groups.getByRole('checkbox', { name: new RegExp(first) }).check();
  await groups.getByRole('checkbox', { name: new RegExp(second) }).check();
  await groups.getByRole('button', { name: 'Crear grupo' }).click();

  const childRow = groups.locator('.group-row').filter({ hasText: childGroup });
  await expect(childRow).toContainText('2 solicitud(es) en total');

  // A group holding the previous group plus one request of its own.
  await groups.getByLabel('Nombre del grupo').fill(parentGroup);
  await groups.getByRole('checkbox', { name: new RegExp(third) }).check();
  await groups.getByRole('checkbox', { name: new RegExp(childGroup) }).check();
  await groups.getByRole('button', { name: 'Crear grupo' }).click();

  const parentRow = groups.locator('.group-row').filter({ hasText: parentGroup });
  await expect(parentRow).toContainText('3 solicitud(es) en total');

  // Synchronizing the parent must carry the nested group along.
  await parentRow.getByRole('button', { name: /Sincronizar grupo/ }).click();
  await expect(parentRow.getByRole('button', { name: /Sincronizar grupo/ })).toBeEnabled({ timeout: 25000 });

  await page.getByRole('link', { name: 'Solicitudes', exact: true }).click();
  for (const name of [first, second, third]) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toContainText('Enviada');
  }

  // The processed payload must be the one that reached the central backend.
  await page.getByRole('button', { name: new RegExp(first) }).click();
  const id = await page.locator('dt').filter({ hasText: /^Id$/ }).locator('+ dd').textContent();
  const token = await backendToken(request);
  const response = await request.get(backendUrl + '/requests/' + id, {
    headers: { authorization: 'Bearer ' + token }
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ id, payload: 'ALPHA', status: 'Processed' });

  // Groups survive a reload because they live in PostgreSQL, not in component state.
  await page.getByRole('link', { name: 'Agrupaciones' }).click();
  await page.reload();
  await expect(groups.locator('.group-row').filter({ hasText: parentGroup })).toContainText('3 solicitud(es) en total');

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);

  const screenshot = testInfo.outputPath('groups.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('groups', { path: screenshot, contentType: 'image/png' });
});

test('rejects a group without a name or without members', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Agrupaciones' }).click();
  const groups = page.locator('.group-panel');

  await groups.getByRole('button', { name: 'Crear grupo' }).click();
  await expect(groups.getByRole('alert')).toContainText('El nombre es obligatorio.');

  await groups.getByLabel('Nombre del grupo').fill('Grupo vacio');
  await groups.getByRole('button', { name: 'Crear grupo' }).click();
  await expect(groups.getByRole('alert')).toContainText('Selecciona al menos una solicitud o grupo.');
});
