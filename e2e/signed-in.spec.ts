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

// Roles (pwa-kit STANDARD.md "Roles"): test-helper is the household's helper. They log their own
// feeds and change those, but not what someone else logged, and are told who can.
test.describe('as a helper', () => {
  test.beforeAll(async () => {
    // Other apps' runs may reseed the household with an older kit that has no helper: put it back.
    const { seedTestHousehold } = await import('@huishouden/pwa-kit/staging');
    await seedTestHousehold({ accessToken: process.env.HH_STAGING_ACCESS_TOKEN! });
  });

  test("a helper logs and changes their own feed but can't change a member's", async ({ page, browser }) => {
    // A member's feed, logged first (which also starts the log in a fresh household).
    const ml = 201 + (Date.now() % 799);
    const admin = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    try {
      const theirs = await admin.newPage();
      await signInTestUser(theirs, { email: 'test-a@example.com' });
      await openLog(theirs);
      await theirs.getByRole('button', { name: 'Log bottle feed' }).click();
      await theirs.getByRole('dialog', { name: 'Bottle feed' }).getByLabel('Amount in ml').fill(String(ml));
      await theirs.getByRole('dialog', { name: 'Bottle feed' }).getByRole('button', { name: 'Log bottle' }).click();
      await expect(theirs.getByText(new RegExp(`^Logged bottle, ${ml} ml at `))).toBeVisible();
    } finally {
      await admin.close();
    }

    await signInTestUser(page, { email: 'test-helper@example.com' });
    await expect(page.getByRole('button', { name: 'Log bottle feed' })).toBeVisible({ timeout: 20_000 });
    const timeline = page.getByRole('list', { name: 'Timeline' });
    const members = timeline.getByRole('listitem').filter({ hasText: new RegExp(`\\b${ml} ml\\b`) });
    await expect(members.first()).toBeVisible({ timeout: 20_000 });
    // Refused: no edit on the member's feed, and the reason said; the baby's details aren't theirs to edit.
    await expect(members.first().getByRole('button', { name: /^Edit / })).toHaveCount(0);
    await expect(page.getByText('Only admins and members can change or delete what someone else added.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit baby details' })).toHaveCount(0);

    // Permitted: their own feed, which they can open and delete.
    const mine = ml === 999 ? 998 : ml + 1;
    await page.getByRole('button', { name: 'Log bottle feed' }).click();
    await page.getByRole('dialog', { name: 'Bottle feed' }).getByLabel('Amount in ml').fill(String(mine));
    await page.getByRole('dialog', { name: 'Bottle feed' }).getByRole('button', { name: 'Log bottle' }).click();
    const own = timeline.getByRole('listitem').filter({ hasText: new RegExp(`\\b${mine} ml\\b`) }).first();
    await expect(own).toBeVisible();
    await own.getByRole('button', { name: /^Edit / }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(timeline.getByText(new RegExp(`\\b${mine} ml\\b`))).toHaveCount(0, { timeout: 20_000 });
  });
});
