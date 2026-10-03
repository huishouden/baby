import { expect, test } from '@playwright/test';
import {
  expectCleanLoad,
  expectCompactSampleBanner,
  expectGoogleSignInPopup,
  expectHuishoudenFrame,
  expectInstallable,
  expectSecurityHeaders,
} from '@huishouden/pwa-kit/e2e';

test('loads without runtime errors and shows the sample countdown', async ({ page }) => {
  await expectCleanLoad(page);
  await expect(page.getByText('Sample data')).toBeVisible();
  await expect(page.getByText('12 weeks')).toBeVisible();
  await expectHuishoudenFrame(page, { app: 'Baby', portalUrl: '/' });
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

test('agenda links open their tab', async ({ page }) => {
  await expectCleanLoad(page, '/#appointments');
  await expect(page.getByRole('heading', { name: 'Appointments', exact: true })).toBeVisible();
  await page.evaluate(() => (location.hash = '#checklists'));
  await expect(page.getByRole('heading', { name: 'Checklists', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Appointments', exact: true })).toHaveCount(0);
});

test('sends the security headers and leaves sign-in un-framed', ({ request }) => expectSecurityHeaders(request, './', { camera: true }));

test('the Sample data banner is one line on a phone', ({ page }) => expectCompactSampleBanner(page, './'));
