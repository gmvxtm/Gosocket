import { test, expect } from '@playwright/test';
import { account, signIn } from './support';

test('a private screen cannot be reached without signing in', async ({ page }) => {
  await page.goto('/status');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
});

test('wrong credentials are rejected and the session survives a reload', async ({ page }, testInfo) => {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(account.username);
  await page.getByLabel('Contrasena').fill('clave-incorrecta');
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(page.getByRole('alert')).toContainText('Invalid username or password');
  await expect(page).toHaveURL(/\/login$/);

  await signIn(page);
  await expect(page.getByRole('link', { name: 'Estado' })).toBeVisible();

  // The token is kept, so reloading does not send the user back to the login.
  await page.reload();
  await expect(page.getByRole('link', { name: 'Estado' })).toBeVisible();

  const screenshot = testInfo.outputPath('session.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('session', { path: screenshot, contentType: 'image/png' });
});

test('the interface changes language and remembers the choice', async ({ page }) => {
  await signIn(page);

  await expect(page.getByRole('link', { name: 'Nueva solicitud' })).toBeVisible();
  await page.getByLabel('Idioma').selectOption('en');
  await expect(page.getByRole('link', { name: 'New request' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: 'New request' })).toBeVisible();

  await page.getByLabel('Language').selectOption('es');
  await expect(page.getByRole('link', { name: 'Nueva solicitud' })).toBeVisible();
});

test('signing out clears the session', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'Salir' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/groups');
  await expect(page).toHaveURL(/\/login$/);
});
