import { expect, test } from '@playwright/test';
import { useTestHousehold } from '@huishouden/pwa-kit/e2e';

// The kick counter signed in, against the real rules. Its own file: the household of a spec file
// stays before the birth here, where signed-in.spec.ts has the baby born to test the log. Run with
// signed-in.spec.ts (`bun run e2e:emulator`).
const hh = useTestHousehold(test);

test('a helper counts and ends a session a member started, and can’t delete it', async ({ browser }) => {
  const admin = await hh.open(browser, 'admin');
  await admin.getByRole('button', { name: 'Kick counter', exact: true }).first().click();
  await admin.getByRole('button', { name: 'Start counting' }).click();
  await admin.getByRole('button', { name: /^Movement/ }).click();
  await expect(admin.getByTestId('kick-progress')).toHaveText('1 of 10 movements');

  const page = await hh.open(browser, 'helper');
  await page.getByRole('button', { name: 'Kick counter', exact: true }).first().click();
  await expect(page.getByTestId('kick-progress')).toHaveText('1 of 10 movements', { timeout: 20_000 });
  await page.getByRole('button', { name: /^Movement/ }).click();
  await expect(page.getByTestId('kick-progress')).toHaveText('2 of 10 movements');
  await page.getByRole('button', { name: 'Stop counting' }).click();
  await expect(page.getByRole('button', { name: 'Start counting' })).toBeVisible();
  // Kept by the server (a refused write would put the session back after a reload).
  await page.waitForTimeout(3000);
  await page.reload();
  await page.getByRole('button', { name: 'Kick counter', exact: true }).first().click();
  await expect(page.getByTestId('kick-last')).toContainText('2 of 10 movements', { timeout: 20_000 });
  await expect(page.getByRole('button', { name: /^Delete the count/ })).toHaveCount(0);
});
