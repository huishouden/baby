import { expect, test } from '@playwright/test';
import { captureScreenshot } from '@piekstra/huishouden-pwa-kit/e2e';

// README images of the signed-out app's invented sample family, refreshed by CI after each deploy.
// The clock is frozen at the sample data's moment so every run renders the same.
const fixedTime = '2031-05-14T10:30:00';

test('before: countdown', ({ page }) =>
  captureScreenshot(page, 'before', {
    fixedTime,
    prepare: (p) => expect(p.getByText('12 weeks')).toBeVisible(),
  }));

test('after: log', ({ page }) =>
  captureScreenshot(page, 'log', {
    path: '/?demo=after',
    fixedTime,
    prepare: (p) => expect(p.getByText('Last fed')).toBeVisible(),
  }));

test('checklists', ({ page }) =>
  captureScreenshot(page, 'checklists', {
    fixedTime,
    prepare: async (p) => {
      await p.getByRole('button', { name: 'Checklists', exact: true }).click();
      await expect(p.getByText('Install the car seat')).toBeVisible();
    },
  }));

test('phone: log', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await captureScreenshot(page, 'phone-log', {
    path: '/?demo=after',
    fixedTime,
    prepare: (p) => expect(p.getByText('Last fed')).toBeVisible(),
  });
});
