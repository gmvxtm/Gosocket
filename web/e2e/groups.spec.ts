import { test, expect, type Page } from '@playwright/test';

const backendUrl = process.env.E2E_BACKEND_URL ?? 'http://localhost:5080';

async function createRequest(page: Page, name: string, payload: string) {
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Payload', { exact: true }).fill(payload);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('button', { name: new RegExp(name) })).toContainText('Pending');
}

test('groups nest, report their total and synchronize as a unit', async ({ page, request }, testInfo) => {
  const stamp = testInfo.project.name + ' ' + Date.now();
  const first = 'Child A ' + stamp;
  const second = 'Child B ' + stamp;
  const third = 'Parent own ' + stamp;
  const childGroup = 'Child group ' + stamp;
  const parentGroup = 'Parent group ' + stamp;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/');
  await expect(page.getByText('Sync service online')).toBeVisible();

  await createRequest(page, first, 'alpha');
  await createRequest(page, second, 'beta');
  await createRequest(page, third, 'gamma');

  const groups = page.locator('.group-panel');
  await expect(groups.getByRole('heading', { name: 'Groups' })).toBeVisible();

  // A group holding two requests.
  await groups.getByLabel('Group name').fill(childGroup);
  await groups.getByRole('checkbox', { name: new RegExp(first) }).check();
  await groups.getByRole('checkbox', { name: new RegExp(second) }).check();
  await groups.getByRole('button', { name: 'Create group' }).click();

  const childRow = groups.locator('.group-row').filter({ hasText: childGroup });
  await expect(childRow).toContainText('2 request(s) in total');

  // A group holding the previous group plus one request of its own.
  await groups.getByLabel('Group name').fill(parentGroup);
  await groups.getByRole('checkbox', { name: new RegExp(third) }).check();
  await groups.getByRole('checkbox', { name: new RegExp(childGroup) }).check();
  await groups.getByRole('button', { name: 'Create group' }).click();

  const parentRow = groups.locator('.group-row').filter({ hasText: parentGroup });
  await expect(parentRow).toContainText('3 request(s) in total');

  // Synchronizing the parent must carry the nested group along.
  await parentRow.getByRole('button', { name: /Sync group/ }).click();
  await expect(page.getByRole('status')).toContainText('Sent 3', { timeout: 25000 });

  for (const name of [first, second, third]) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toContainText('Processed');
  }

  // The processed payload must be the one that reached the central backend.
  await page.getByRole('button', { name: new RegExp(first) }).click();
  const id = await page.locator('dt').filter({ hasText: /^Id$/ }).locator('+ dd').textContent();
  const response = await request.get(backendUrl + '/requests/' + id);
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ id, payload: 'ALPHA', status: 'Processed' });

  // Groups survive a reload because they live in PostgreSQL, not in component state.
  await page.reload();
  await expect(groups.locator('.group-row').filter({ hasText: parentGroup })).toContainText('3 request(s) in total');

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  const screenshot = testInfo.outputPath('groups.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('groups', { path: screenshot, contentType: 'image/png' });
});

test('rejects a group without a name or without members', async ({ page }) => {
  await page.goto('/');
  const groups = page.locator('.group-panel');

  await groups.getByRole('button', { name: 'Create group' }).click();
  await expect(groups.getByRole('alert')).toContainText('Name is required.');

  await groups.getByLabel('Group name').fill('Empty group');
  await groups.getByRole('button', { name: 'Create group' }).click();
  await expect(groups.getByRole('alert')).toContainText('Select at least one request or group.');
});
