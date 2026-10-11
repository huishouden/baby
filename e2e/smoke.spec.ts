import { expect, test } from '@playwright/test';
import {
  expectCleanLoad,
  expectBottomNav,
  expectCompactSampleBanner,
  expectGoogleSignInPopup,
  expectHuishoudenFrame,
  expectInstallable,
  expectSecurityHeaders,
  expectThemeConsistent,
} from '@huishouden/pwa-kit/e2e';

test('loads without runtime errors and shows the sample countdown', async ({ page }) => {
  await expectCleanLoad(page);
  await expect(page.getByText('Sample data')).toBeVisible();
  await expect(page.getByText('12 weeks')).toBeVisible();
  await expectHuishoudenFrame(page, { app: 'Baby', portalUrl: '/' });
});

test('the sample log answers a one-tap feed with an undo', async ({ page }) => {
  await expectCleanLoad(page, './?demo=after');
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
  await expectCleanLoad(page, './#appointments');
  await expect(page.getByRole('heading', { name: 'Appointments', exact: true })).toBeVisible();
  await page.evaluate(() => (location.hash = '#checklists'));
  await expect(page.getByRole('heading', { name: 'Checklists', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Appointments', exact: true })).toHaveCount(0);
});

test('sends the security headers and leaves sign-in un-framed', ({ request }) => expectSecurityHeaders(request, './', { camera: true }));

test('the Sample data banner is one line on a phone', ({ page }) => expectCompactSampleBanner(page, './'));

test('on a phone the sections are a bottom bar', ({ page }) => expectBottomNav(page, { path: './', labels: ['Overview', 'Timer', 'Kicks', 'Visits', 'More'] }));

test('a sample checklist item is skipped and put back, counting neither as done nor as to do', async ({ page }) => {
  await expectCleanLoad(page, './#checklists');
  const nursery = page.getByRole('region', { name: 'Nursery' });
  const skipped = (text: string) => nursery.getByRole('listitem').filter({ hasText: text }).getByText('Skipped', { exact: true });
  await expect(skipped('Night light')).toBeVisible();
  await expect(nursery.getByText('3 of 5 done, 1 skipped')).toBeVisible();
  await nursery.getByRole('button', { name: 'Skip: Changing pad' }).click();
  await expect(skipped('Changing pad')).toBeVisible();
  await expect(nursery.getByText('3 of 4 done, 2 skipped')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(nursery.getByRole('checkbox', { name: 'Changing pad' })).toBeVisible();
  await nursery.getByRole('button', { name: 'Un-skip: Night light' }).click();
  await expect(nursery.getByRole('checkbox', { name: 'Night light' })).toBeVisible();
  await expect(nursery.getByText('3 of 6 done')).toBeVisible();
});

test('done and not done read differently: an outlined Mark done, then a done row; checklists sort done after open', async ({ page }) => {
  await expectCleanLoad(page, './');
  const card = page.getByRole('region', { name: 'Checklists' });
  const nursery = card.getByRole('listitem').filter({ hasText: 'Nursery' });
  await expect(nursery).toHaveAttribute('data-completion', 'open');
  await nursery.getByRole('button', { name: 'Mark Changing pad done' }).click();
  await nursery.getByRole('button', { name: 'Mark Swaddles and sleep sacks done' }).click();
  await expect(nursery).toHaveAttribute('data-completion', 'done');
  await expect(nursery.getByRole('button')).toHaveCount(0);
  await expect(nursery.getByText('5 of 5 done, 1 skipped')).toBeVisible();
  await expect(card.getByRole('listitem').last()).toContainText('Nursery');
  await expect(page.locator('[aria-pressed]').filter({ hasText: /done/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(nursery.getByRole('button', { name: 'Mark Swaddles and sleep sacks done' })).toBeVisible();

  await page.getByRole('button', { name: 'Checklists', exact: true }).first().click();
  const list = page.getByRole('region', { name: 'Nursery' });
  await expect(list.getByRole('checkbox', { name: 'Changing pad', checked: true })).toBeVisible();
  await expect(list.getByRole('checkbox', { name: 'Swaddles and sleep sacks', checked: false })).toBeVisible();
  const order = await list.getByRole('listitem').allInnerTexts();
  expect(order[0]).toContain('Swaddles and sleep sacks');
  expect(order.at(-1)).toContain('Night light');
  await expect(list.getByRole('button', { name: 'Move up: Changing pad' })).toHaveCount(0);
});

test('follows the suite theme: dark on a dark device, readable', ({ page }) => expectThemeConsistent(page, { path: './' }));

test('a kid has no contraction timer', async ({ page }) => {
  await expectCleanLoad(page, './?as=kid');
  await expect(page.getByRole('button', { name: /Contractions|Timer/ })).toHaveCount(0);
});

test('the contraction timer starts, stops and removes a mistaken tap', async ({ page }) => {
  await expectCleanLoad(page);
  await page.getByRole('button', { name: /Contractions/ }).first().click();
  await expect(page.getByRole('note').filter({ hasText: 'Call your provider' })).toContainText('Call your provider or L&D right away');
  await expect(page.getByTestId('status')).toBeVisible();
  const before = await page.getByRole('button', { name: /^Delete the contraction/ }).count();
  await page.getByRole('button', { name: /^Start/ }).click();
  await expect(page.getByTestId('elapsed')).toBeVisible();
  await page.getByRole('button', { name: /^Stop/ }).click();
  await expect(page.getByRole('button', { name: /^Delete the contraction/ })).toHaveCount(before + 1);
  await page.getByRole('button', { name: /^Start/ }).click();
  await page.getByRole('button', { name: /Mistaken tap/ }).click();
  await expect(page.getByRole('button', { name: /^Delete the contraction/ })).toHaveCount(before + 1);
});

// Sets the sample's due date through the Overview dialog. The sample lives on 14 May 2031.
async function setDue(page: import('@playwright/test').Page, ymd: string) {
  await page.getByRole('button', { name: 'Edit due date and name' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Due date').fill(ymd);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
}

test('labor or practice: before 37 weeks the call note is out, the comparison folds', async ({ page }) => {
  await expectCleanLoad(page);
  await page.getByRole('button', { name: /Contractions/ }).first().click();
  const card = page.getByTestId('labor-or-practice');
  await expect(card.getByTestId('preterm-note')).toContainText("Before 37 weeks: call L&D now. Don't wait to tell them apart.");
  await expect(card.getByTestId('preterm-note').getByRole('link', { name: /^Call / })).toHaveAttribute('href', /^tel:/);
  const toggle = card.getByRole('button', { name: /Labor or practice contractions\?/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(card.getByTestId('red-flags')).toBeHidden();
  const box = await toggle.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(card.getByTestId('red-flags')).toContainText('Your water breaks or fluid leaks');
  await expect(card.getByRole('columnheader', { name: 'Practice (Braxton Hicks)' })).toBeVisible();
  await expect(card.getByRole('columnheader', { name: 'Labor', exact: true })).toBeVisible();
  await expect(card.getByText('Empty your bladder.')).toBeVisible();
  await expect(card.getByText('Sources: ACOG, Cleveland Clinic, MedlinePlus')).toBeVisible();
  await expect(card.getByText(/Not medical advice\. Your provider's instructions come first\./)).toBeVisible();
});

test('labor or practice: from 37 weeks there is no preterm note, the red flags stay', async ({ page }) => {
  await expectCleanLoad(page);
  await setDue(page, '2031-05-24');
  await page.getByRole('button', { name: /Contractions/ }).first().click();
  await expect(page.getByText('38 weeks 4 days pregnant')).toBeVisible();
  const card = page.getByTestId('labor-or-practice');
  await card.getByRole('button', { name: /Labor or practice contractions\?/ }).click();
  await expect(card.getByTestId('red-flags')).toBeVisible();
  await expect(card.getByText(/^Before 37 weeks/)).toHaveCount(0);
});

test('a kid has no kick counter', async ({ page }) => {
  await expectCleanLoad(page, './?as=kid');
  await expect(page.getByRole('button', { name: /Kick counter|Kicks/ })).toHaveCount(0);
});

test('the kick counter counts to the target, undoes a tap, and keeps the guidance in view', async ({ page }) => {
  await expectCleanLoad(page);
  await page.getByRole('button', { name: 'Kick counter', exact: true }).first().click();
  await expect(page.getByTestId('kick-guidance')).toContainText("Call your provider or L&D right away if movements seem fewer, weaker or different from usual, or you haven't felt 10 movements in 2 hours");
  await expect(page.getByTestId('kick-guidance')).toContainText("Your provider's instructions come first");
  await expect(page.getByTestId('kick-day')).toHaveCount(14);
  const before = await page.getByTestId('kick-row').count();
  await page.getByRole('button', { name: 'Start counting' }).click();
  await expect(page.getByTestId('kick-progress')).toHaveText('0 of 10 movements');
  const movement = page.getByRole('button', { name: /^Movement/ });
  for (let i = 0; i < 4; i++) await movement.click();
  await expect(page.getByTestId('kick-progress')).toHaveText('4 of 10 movements');
  await page.getByRole('button', { name: 'Undo last tap' }).click();
  await expect(page.getByTestId('kick-progress')).toHaveText('3 of 10 movements');
  for (let i = 0; i < 7; i++) await movement.click();
  await expect(page.getByRole('button', { name: 'Start counting' })).toBeVisible();
  await expect(page.getByTestId('kick-last')).toContainText(/10 movements in \d+ min/);
  await expect(page.getByTestId('kick-row')).toHaveCount(before + 1);
  // A note on the new count.
  await page.getByTestId('kick-row').first().getByRole('button', { name: /^Edit the note/ }).click();
  await page.getByRole('textbox', { name: 'Note' }).fill('After dinner');
  await page.getByRole('region', { name: 'Kick count history' }).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('kick-note').first()).toHaveText('After dinner');
});

test('a count stopped early and a mistaken start', async ({ page }) => {
  await expectCleanLoad(page, './#kicks');
  const before = await page.getByTestId('kick-row').count();
  await page.getByRole('button', { name: 'Start counting' }).click();
  await page.getByRole('button', { name: /^Movement/ }).click();
  await page.getByRole('button', { name: 'Stop counting' }).click();
  await expect(page.getByTestId('kick-last')).toContainText('1 of 10 movements');
  await expect(page.getByTestId('kick-row')).toHaveCount(before + 1);
  await page.getByRole('button', { name: 'Start counting' }).click();
  await page.getByRole('button', { name: 'Remove this count' }).click();
  await expect(page.getByTestId('kick-row')).toHaveCount(before + 1);
});

test('the kick counter settings save a target', async ({ page }) => {
  await expectCleanLoad(page, './#kicks');
  await page.getByRole('button', { name: 'Count fewer movements' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('kick-target')).toHaveText('9');
  await expect(page.getByTestId('kick-guidance')).toContainText("haven't felt 9 movements in 2 hours");
});

test('two hours under the target shows Call L&D now with the contact’s call button', async ({ page }) => {
  await page.clock.install();
  await expectCleanLoad(page, './#kicks');
  await page.getByRole('button', { name: 'Start counting' }).click();
  await page.getByRole('button', { name: /^Movement/ }).click();
  await expect(page.getByTestId('kick-call')).toHaveCount(0);
  await page.clock.fastForward('01:59:00');
  await expect(page.getByTestId('kick-call')).toHaveCount(0);
  await page.clock.fastForward('00:02:00');
  await expect(page.getByTestId('kick-call')).toContainText('Call L&D now');
  await expect(page.getByTestId('kick-call').getByRole('link', { name: /^Call / })).toHaveAttribute('href', /^tel:/);
  // The guidance stays in view throughout.
  await expect(page.getByTestId('kick-guidance')).toBeVisible();
});
