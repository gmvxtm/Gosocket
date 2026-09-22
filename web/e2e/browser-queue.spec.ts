import { test, expect } from '@playwright/test';
import { account, backendToken, backendUrl, browserWebUrl, createRequest, signIn, syncServiceUrl } from './support';

/**
 * The build served here keeps the queue in IndexedDB, which is the only option for a client
 * that cannot run the local service, such as a phone.
 */
test('creates requests with the network cut and synchronizes them when it comes back', async ({ page, context, request }, testInfo) => {
  const prefix = 'Offline ' + testInfo.project.name + ' ' + Date.now();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await signIn(page, browserWebUrl);
  await expect(page.getByText('Cola en el navegador')).toBeVisible();

  // From here the browser is on its own: no service, no central API, no connectivity at all.
  await context.setOffline(true);
  await expect(page.getByText('Servicio local sin conexion')).toBeVisible({ timeout: 20000 });

  await createRequest(page, prefix + ' 1', 'hello gosocket');
  await createRequest(page, prefix + ' 2', 'segunda solicitud');

  await page.getByRole('link', { name: 'Estado' }).click();
  await expect(page.locator('.counter-card.pending')).toContainText('2');

  const offlineShot = testInfo.outputPath('browser-queue-offline.png');
  await page.screenshot({ path: offlineShot, fullPage: true });
  await testInfo.attach('cola sin conexion', { path: offlineShot, contentType: 'image/png' });

  // Nothing of this reached the local service: its database never saw these requests.
  await context.setOffline(false);
  const session = await request.post(syncServiceUrl + '/auth/login', { data: account });
  const local = await request.get(syncServiceUrl + '/requests', {
    headers: { authorization: 'Bearer ' + (await session.json()).token }
  });
  const storedNames = ((await local.json()) as { name: string }[]).map(item => item.name);
  expect(storedNames.filter(name => name.startsWith(prefix))).toEqual([]);

  // Reloading proves the queue is in IndexedDB and not in the memory of the page.
  await page.reload();
  await expect(page.locator('.counter-card.pending')).toContainText('2');

  await page.getByRole('button', { name: 'Sincronizar' }).click();
  await expect(page.getByRole('status')).toContainText('Ultima sincronizacion', { timeout: 25000 });
  await expect(page.locator('.counter-card.pending')).toContainText('0');

  await page.getByRole('link', { name: 'Solicitudes', exact: true }).click();
  const row = page.getByRole('button', { name: new RegExp(prefix + ' 1') });
  await expect(row).toContainText('Enviada');
  await row.click();
  const id = await page.locator('.detail-panel dt').filter({ hasText: /^Id$/ }).locator('+ dd').textContent();

  // The central registry received the processed payload under the id the browser generated.
  const token = await backendToken(request);
  const registered = await request.get(backendUrl + '/requests/' + id, {
    headers: { authorization: 'Bearer ' + token }
  });
  expect(registered.status()).toBe(200);
  expect(await registered.json()).toMatchObject({ id, payload: 'HELLO GOSOCKET', status: 'Processed' });

  const screenshot = testInfo.outputPath('browser-queue.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('cola sincronizada', { path: screenshot, contentType: 'image/png' });
  expect(errors).toEqual([]);
});
