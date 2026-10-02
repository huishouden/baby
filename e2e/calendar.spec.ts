import { expect, test } from '@playwright/test';
import { calendarEvents, mockCalendar } from './fixtures/calendar';

// Google Calendar has no emulator, and the sample app has no Google account: these tests stand in
// for the calendar with window.__mockCalendarEvents, which the kit's search answers from.

test('signed out, calendar search is off and says why', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Appointments', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Import from calendar' })).toBeDisabled();
  await expect(page.getByText('Sign in to search your calendar.')).toBeVisible();
  await page.getByRole('button', { name: 'Add appointment' }).click();
  const dialog = page.getByRole('dialog', { name: 'New appointment' });
  await dialog.getByLabel('What').fill('Prenatal visit');
  await expect(dialog.getByRole('button', { name: 'Find in my calendar' })).toBeDisabled();
  await expect(dialog.getByText('Sign in to search your calendar.')).toBeVisible();
});

test.describe('with a calendar', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(mockCalendar, calendarEvents);
    await page.goto('/');
    await page.getByRole('button', { name: 'Appointments', exact: true }).click();
  });

  test('Find in my calendar fills the appointment and links the event', async ({ page }) => {
    await page.getByRole('button', { name: 'Add appointment' }).click();
    const dialog = page.getByRole('dialog', { name: 'New appointment' });
    await dialog.getByLabel('What').fill('Prenatal visit');
    await expect(dialog.getByText('Google will ask once to let Baby read your calendar. Baby never changes it.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Find in my calendar' }).click();

    const match = dialog.getByRole('list', { name: 'Calendar matches' }).getByRole('button', { name: /Prenatal visit/ });
    await expect(match).toContainText('Family');
    await match.click();
    await expect(dialog.getByLabel('Date')).toHaveValue('2031-06-03');
    await expect(dialog.getByLabel('Time')).toHaveValue('09:30');
    await expect(dialog.getByLabel('Where (optional)')).toHaveValue('40 River Road, Springfield');
    await expect(dialog.getByLabel('Notes (optional)')).toHaveValue('Bring the glucose results.');
    await expect(dialog.getByRole('link', { name: 'Open in Calendar' })).toHaveAttribute('href', 'https://calendar.example.com/event?eid=evt-prenatal');
    await expect(dialog.getByText('Google will ask once')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Save' }).click();

    const row = page.locator('main li', { hasText: 'Prenatal visit' });
    await expect(row.getByRole('link', { name: 'Open in Calendar' })).toHaveAttribute('href', 'https://calendar.example.com/event?eid=evt-prenatal');
  });

  test('Import from calendar lists new events once and adds them', async ({ page }) => {
    await page.getByRole('button', { name: 'Import from calendar' }).click();
    const dialog = page.getByRole('dialog', { name: 'Import from calendar' });
    const list = dialog.getByRole('list', { name: 'Calendar events' });
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await expect(list).not.toContainText('Glucose test');

    await list.getByRole('button', { name: 'Add Prenatal visit' }).click();
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await expect(page.getByText('Added Prenatal visit')).toBeVisible();

    await dialog.getByRole('button', { name: 'Add all 2' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Added 2 appointments')).toBeVisible();
    const upcoming = page.getByRole('region', { name: 'Upcoming appointments' });
    for (const title of ['Prenatal visit', 'Lactation class', 'Pediatrician meet and greet']) await expect(upcoming.getByText(title, { exact: true })).toBeVisible();
    await expect(upcoming.locator('li', { hasText: 'Lactation class' }).getByRole('link', { name: 'Open in Calendar' })).toBeVisible();

    await page.getByRole('button', { name: 'Import from calendar' }).click();
    await expect(dialog.getByText('Every baby event in your calendar is already in Baby.')).toBeVisible();
  });

  test('a closed permission window is explained, with Try again', async ({ page }) => {
    await page.evaluate(() => {
      Object.defineProperty(window, '__mockCalendarEvents', {
        configurable: true,
        get() {
          throw Object.assign(new Error('Firebase: Error (auth/popup-closed-by-user).'), { code: 'auth/popup-closed-by-user' });
        },
      });
    });
    await page.getByRole('button', { name: 'Import from calendar' }).click();
    const alert = page.getByRole('dialog', { name: 'Import from calendar' }).getByRole('alert');
    await expect(alert).toContainText('Calendar access was not allowed');
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});
