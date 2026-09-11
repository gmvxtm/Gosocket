import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const backendUrl = process.env.E2E_BACKEND_URL ?? 'http://localhost:5080';

export const account = {
  username: process.env.E2E_USERNAME ?? 'admin',
  password: process.env.E2E_PASSWORD ?? 'Admin.12345'
};

/** Signs in through the interface and waits for the workspace to be ready. */
export async function signIn(page: Page) {
  await page.goto('/login');
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

export async function createRequest(page: Page, name: string, payload: string) {
  await page.getByRole('link', { name: 'Nueva solicitud' }).click();
  await page.getByLabel('Nombre').fill(name);
  await page.getByLabel('Contenido').fill(payload);
  await page.getByRole('button', { name: 'Crear' }).click();
  // Creating opens the detail of the new request.
  await expect(page.locator('.detail-panel')).toContainText(name);
}
