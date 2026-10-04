import { expect, test } from '@playwright/test';
import { expectLocalized, useLanguage } from '@huishouden/pwa-kit/e2e';
import es from '../src/locales/es.json' with { type: 'json' };
import nl from '../src/locales/nl.json' with { type: 'json' };

// The signed-out sample in Spanish and Dutch, before and after the birth: Baby's own chrome and the
// kit's, no English left. Appointment titles, places and contacts are sample data and stay as entered.
const BEFORE = ['Countdown', 'Next appointment', 'Checklists', 'Appointments', 'Contacts', 'Baby is here', 'Before birth', 'After birth', 'Overview', 'to go'];
const AFTER = ['Last fed', 'Last diaper', 'Fell asleep', 'Breast feed', 'Feeds', 'Diapers', 'Pumped', 'Asleep for', 'Awake for', 'Bottle'];

for (const [lang, messages] of [
  ['es', es],
  ['nl', nl],
] as const) {
  test(`the sample before the birth in ${lang}`, async ({ page }) => {
    await expectLocalized(page, lang, { words: BEFORE });
    await expect(page.getByRole('region', { name: messages['overview.countdown'] })).toContainText(messages['countdown.toGo']);
    await expect(page.getByRole('region', { name: messages['checklists.title'] })).toContainText(messages['template.bag']);

    await page.goto('./#appointments', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: messages['appointments.add'] }).click();
    const dialog = page.getByRole('dialog', { name: messages['appointmentDialog.new'] });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(messages['appointmentDialog.what'], { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
  });

  test(`the sample log after the birth in ${lang}`, async ({ page }) => {
    await expectLocalized(page, lang, { path: './?demo=after', words: AFTER });
    await page.getByRole('button', { name: messages['log.logBreastRight'] }).click();
    await expect(page.getByText(messages['log.justNow'])).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
  });
}

test('the starter checklists and the care team in Spanish', async ({ page }) => {
  await useLanguage(page, 'es');
  await page.goto('./#checklists', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: es['template.paperwork'] })).toBeVisible();
  await expect(page.getByText(es['template.paperwork.pediatrician'])).toBeVisible();
  // The sample's pediatrician is saved as "Pediatrician" and shown under the Spanish role.
  await page.goto('./#contacts', { waitUntil: 'networkidle' });
  await expect(page.getByText(es['role.pediatrician'], { exact: true })).toBeVisible();
  await expect(page.getByText('Pediatrician', { exact: true })).toHaveCount(0);
});
