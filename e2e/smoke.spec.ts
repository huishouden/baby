import { expect, test } from '@playwright/test';
import { expectCleanLoad, expectGoogleSignInPopup, expectInstallable } from '@piekstra/huishouden-pwa-kit/e2e';

test('loads without runtime errors and shows the sample countdown', async ({ page }) => {
  await expectCleanLoad(page);
  await expect(page.getByText('Sample data')).toBeVisible();
  await expect(page.getByText('12 weeks')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Huishouden home' })).toHaveAttribute('href', 'https://huishouden-piekstra.web.app');
});

test('the sample log answers a one-tap feed with an undo', async ({ page }) => {
  await expectCleanLoad(page, '/?demo=after');
  await expect(page.getByText('Last fed')).toBeVisible();
  await page.getByRole('button', { name: 'Log breast feed, right' }).click();
  await expect(page.getByText(/Logged feed, right/)).toBeVisible();
  await expect(page.getByText('Just now')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Just now')).toHaveCount(0);
  await expect(page.getByText(/^ago · left,/)).toBeVisible();
});

test('is installable', ({ page, request }) => expectInstallable(page, request));

test('Google sign-in popup reaches Google with an allowed redirect URI', ({ page, context }) =>
  expectGoogleSignInPopup(page, context, async (p) => {
    await p.getByRole('button', { name: 'Sign in with Google' }).first().click();
  }));
