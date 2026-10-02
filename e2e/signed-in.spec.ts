import { expect, test, type Page } from '@playwright/test';
import { signInTestUser } from '@huishouden/pwa-kit/e2e';

// Signed in as an invented test user on the staging site (pwa-kit STANDARD.md "Staging"): the real
// staging Firestore and rules, the seeded test household. Other runs share that household, so each
// test writes a value unique to its run and looks for exactly that.
test.skip(!process.env.HH_STAGING_SA, 'signed-in tests run against staging, in CI');

/** The log is the main screen once the baby is born; a fresh household starts at the countdown. */
async function openLog(page: Page) {
  await expect(page.getByRole('button', { name: /Log breast feed, left|Baby is here/ }).first()).toBeVisible({ timeout: 20_000 });
  if (await page.getByRole('button', { name: 'Baby is here' }).isVisible()) {
    await page.getByRole('button', { name: 'Baby is here' }).click();
    const dialog = page.getByRole('dialog', { name: 'Baby is here' });
    await dialog.getByLabel('Name').fill('Test baby');
    await dialog.getByRole('button', { name: 'Start the log' }).click();
  }
  await expect(page.getByRole('button', { name: 'Log bottle feed' })).toBeVisible();
}

test('a bottle feed one member logs shows for the other', async ({ page, browser }) => {
  await signInTestUser(page, { email: 'test-a@example.com' });
  await openLog(page);
  // 201 to 999 ml: outside the presets and unlikely to match another run's feed.
  const ml = 201 + (Date.now() % 799);
  const feed = (p: Page) => p.getByText(new RegExp(`\\b${ml} ml\\b`)).first();
  await page.getByRole('button', { name: 'Log bottle feed' }).click();
  const dialog = page.getByRole('dialog', { name: 'Bottle feed' });
  await dialog.getByLabel('Amount in ml').fill(String(ml));
  await dialog.getByRole('button', { name: 'Log bottle' }).click();
  await expect(page.getByText(new RegExp(`^Logged bottle, ${ml} ml at `))).toBeVisible();
  await expect(feed(page)).toBeVisible();

  // Saved in the household, not just on this screen: the other member's own browser shows it.
  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const theirs = await other.newPage();
    await signInTestUser(theirs, { email: 'test-b@example.com' });
    await expect(feed(theirs)).toBeVisible({ timeout: 20_000 });
  } finally {
    await other.close();
  }
});

// People on the shared tablet tap and close the app at once. Firestore takes a few milliseconds to
// put a write in its offline cache, so a reload inside that gap used to lose the entry.
for (const leave of ['reload', 'close'] as const) {
  test(`a feed logged just before the app ${leave === 'reload' ? 'reloads' : 'is closed'} is kept`, async ({ page, context }) => {
    await signInTestUser(page, { email: 'test-a@example.com' });
    await openLog(page);
    const ml = 201 + ((Date.now() + (leave === 'close' ? 400 : 0)) % 799);
    await page.getByRole('button', { name: 'Log bottle feed' }).click();
    const dialog = page.getByRole('dialog', { name: 'Bottle feed' });
    await dialog.getByLabel('Amount in ml').fill(String(ml));
    await dialog.getByRole('button', { name: 'Log bottle' }).click();
    if (leave === 'reload') await page.reload();
    else {
      await page.close();
      page = await context.newPage();
      await page.goto('/');
    }
    await openLog(page);
    await expect(page.getByText(new RegExp(`\\b${ml} ml\\b`)).first()).toBeVisible({ timeout: 20_000 });
    // Written again and then forgotten: nothing is left waiting in the outbox.
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('hh-outbox:')).length)).toBe(0);
  });
}
