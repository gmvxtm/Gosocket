import { test, expect } from '@playwright/test';

test('creates locally, synchronizes and displays the confirmed request', async ({ page, request }, testInfo) => {
  const name = 'E2E ' + testInfo.project.name + ' ' + Date.now();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Sync service online')).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Payload', { exact: true }).fill('hello gosocket');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const row = page.getByRole('button', { name: new RegExp(name) });
  await expect(row).toContainText('Pending');
  await page.getByRole('button', { name: 'Sync', exact: true }).click();
  await expect(row).toContainText('Processed', { timeout: 25000 });
  await expect(page.getByRole('status')).toContainText('Sent');
  const id = await page.locator('dt').filter({ hasText: /^Id$/ }).locator('+ dd').textContent();
  const response = await request.get((process.env.E2E_BACKEND_URL ?? 'http://localhost:5080') + '/requests/' + id);
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ id, payload: 'HELLO GOSOCKET', status: 'Processed' });
  await page.reload();
  await expect(page.getByRole('button', { name: new RegExp(name) })).toContainText('Processed');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('requests.png'), fullPage: true });
});
