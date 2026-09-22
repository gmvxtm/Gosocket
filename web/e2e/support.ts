import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const backendUrl = process.env.E2E_BACKEND_URL ?? 'http://localhost:5080';
export const syncServiceUrl = process.env.E2E_SYNC_SERVICE_URL ?? 'http://localhost:3001';
/** The same application built to keep its queue in the browser. */
export const browserWebUrl = process.env.E2E_BROWSER_WEB_URL ?? 'http://localhost:8081';

export const account = {
  username: process.env.E2E_USERNAME ?? 'admin',
  password: process.env.E2E_PASSWORD ?? 'Admin.12345'
};

/** Signs in through the interface and waits for the workspace to be ready. */
export async function signIn(page: Page, origin = '') {
  await page.goto(origin + '/login');
  await page.getByLabel('Usuario').fill(account.username);
  await page.getByLabel('Contrasena').fill(account.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Servicio local en linea')).toBeVisible();
}

/** The central API also requires a session, so checking a record there needs its own token. */
export async function backendToken(request: APIRequestContext) {
  const response = await request.post(backendUrl + '/auth/login', { data: account });
  expect(response.status()).toBe(200);
  return (await response.json()).token as string;
}

/**
 * Filling writes straight into the DOM, and a render that settles right afterwards puts the
 * values of the component back. A person typing cannot hit that window, because every keystroke
 * goes through React; the test can, so it writes the form and confirms it before submitting.
 */
export async function createRequest(page: Page, name: string, payload: string) {
  await page.getByRole('link', { name: 'Nueva solicitud' }).click();
  const nameField = page.getByLabel('Nombre');
  const payloadField = page.getByLabel('Contenido');

  await expect(async () => {
    await nameField.fill(name);
    await payloadField.fill(payload);
    await expect(nameField).toHaveValue(name, { timeout: 1000 });
    await expect(payloadField).toHaveValue(payload, { timeout: 1000 });
  }).toPass({ timeout: 10000 });

  await page.getByRole('button', { name: 'Crear' }).click();
  // Creating opens the detail of the new request.
  await expect(page.locator('.detail-panel')).toContainText(name);
}
