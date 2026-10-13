import { expect, test, type Page } from '@playwright/test';

// The tab lives in the address (kit STANDARD.md "Updates"), so a reload (an update applying) and
// Back return to it. The sample, signed out.

const currentTab = (page: Page) => page.locator('nav[slot="nav"] button[aria-current="page"]');
const sections = (page: Page) => page.getByRole('navigation', { name: 'Sections' });

test('a reload and Back return to the tab in the address', async ({ page }) => {
  await page.goto('./');
  await expect(currentTab(page)).toHaveText('Overview');
  await sections(page).getByRole('button', { name: 'Appointments', exact: true }).click();
  await expect(page).toHaveURL(/\?tab=appointments$/);
  await sections(page).getByRole('button', { name: 'Checklists', exact: true }).click();
  await expect(page).toHaveURL(/\?tab=checklists$/);
  await page.reload();
  await expect(currentTab(page)).toHaveText('Checklists');
  await page.goBack();
  await expect(currentTab(page)).toHaveText('Appointments');
  await page.goForward();
  await expect(currentTab(page)).toHaveText('Checklists');
});

test('an agenda link to #appointments still opens Appointments, kept as ?tab= across a reload', async ({ page }) => {
  await page.goto('./#appointments');
  await expect(currentTab(page)).toHaveText('Appointments');
  await expect(page).toHaveURL(/\?tab=appointments$/);
  await page.reload();
  await expect(currentTab(page)).toHaveText('Appointments');
});

test('the sample’s After-birth view and the tab share the address', async ({ page }) => {
  await page.goto('./?tab=contacts');
  await page.getByRole('group', { name: /sample/i }).getByRole('button').nth(1).click();
  await expect(page).toHaveURL(/demo=after/);
  await expect(page).toHaveURL(/tab=contacts/);
  await page.reload();
  await expect(currentTab(page)).toHaveText('Contacts');
});

test('an agenda link followed while the app is open switches the tab too', async ({ page }) => {
  await page.goto('./?tab=appointments');
  await page.evaluate(() => (location.hash = '#checklists'));
  await expect(currentTab(page)).toHaveText('Checklists');
  await expect(page).toHaveURL(/\?tab=checklists$/);
});
