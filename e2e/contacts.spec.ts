import { expect, test, type Page } from '@playwright/test';
import { stubOpenStreetMap } from '@huishouden/pwa-kit/e2e';
import places from './fixtures/nominatim.json' with { type: 'json' };

// The sample family's care team (signed out, nothing saved). Place search goes to OpenStreetMap's
// Nominatim, stubbed here with invented results; nothing else reaches it (a contact saved with a
// typed address is looked up once, now that the sample family has a home).

test.beforeEach(async ({ page }) => {
  await stubOpenStreetMap(page);
});

const openContacts = async (page: Page) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Contacts', exact: true }).click();
};

test('the care team is one tap from a call or a map', async ({ page }) => {
  await openContacts(page);
  const card = page.getByRole('region', { name: 'Example Pediatrics' });
  await expect(card).toContainText('Pediatrician');
  await expect(card.getByRole('link', { name: 'Call Example Pediatrics, (555) 010-0142' })).toHaveAttribute('href', 'tel:5550100142');
  await expect(card.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Example%20Pediatrics/);
  await expect(card.getByRole('link', { name: 'pediatrics.example.com' })).toHaveAttribute('href', 'https://pediatrics.example.com');
});

test('Find a business fills the contact from OpenStreetMap, only on Search', async ({ page }) => {
  let searches = 0;
  await page.route('https://nominatim.openstreetmap.org/**', (route) => {
    searches++;
    return route.fulfill({ json: places });
  });
  await openContacts(page);
  await page.getByRole('button', { name: 'Add contact' }).click();
  const dialog = page.getByRole('dialog', { name: 'New contact' });
  await dialog.getByLabel('Phone').fill('(555) 010-0199');
  await dialog.getByLabel('Find a business').fill('Example Lactation Springfield');
  expect(searches).toBe(0);
  await expect(dialog.getByText('Results from OpenStreetMap. Missing a phone number? Check Google Maps.')).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Search Google Maps' })).toHaveAttribute(
    'href',
    'https://www.google.com/maps/search/?api=1&query=Example%20Lactation%20Springfield',
  );
  await dialog.getByRole('button', { name: 'Search', exact: true }).click();

  const results = dialog.getByRole('list', { name: 'Places' }).getByRole('button');
  await expect(results).toHaveCount(2);
  await expect(results.first()).toContainText('+1 555 010 0177');
  expect(searches).toBe(1);
  await results.filter({ hasText: 'Example Lactation Center' }).click();

  await expect(dialog.getByLabel('Name')).toHaveValue('Example Lactation Center');
  await expect(dialog.getByLabel('Address')).toHaveValue('3 Demo Lane, Springfield, 00000, United States');
  await expect(dialog.getByLabel('Phone')).toHaveValue('(555) 010-0199');
  await dialog.getByRole('button', { name: 'Lactation consultant' }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();

  const card = page.getByRole('region', { name: 'Example Lactation Center' });
  await expect(card).toContainText('Lactation consultant');
  await expect(card.getByRole('link', { name: /^Call Example Lactation Center/ })).toHaveAttribute('href', 'tel:5550100199');
  await expect(card.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute('href', /query=Example%20Lactation%20Center/);
});

test('a checklist item about choosing someone adds the contact and then shows it', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Checklists', exact: true }).click();
  const paperwork = page.getByRole('region', { name: 'Paperwork' });
  await expect(paperwork.getByRole('link', { name: 'Call Example Pediatrics, (555) 010-0142' })).toBeVisible();

  await paperwork.getByRole('button', { name: 'Add contact: Lactation consultant' }).click();
  const dialog = page.getByRole('dialog', { name: 'New contact' });
  await expect(dialog.getByRole('textbox', { name: 'Role' })).toHaveValue('Lactation consultant');
  await dialog.getByLabel('Name').fill('Example Lactation Care');
  await dialog.getByLabel('Phone').fill('(555) 010-0123');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(paperwork.getByRole('button', { name: 'Add contact: Lactation consultant' })).toHaveCount(0);
  await expect(paperwork.getByText('Example Lactation Care')).toBeVisible();
  await expect(paperwork.getByRole('link', { name: 'Call Example Lactation Care, (555) 010-0123' })).toHaveAttribute('href', 'tel:5550100123');
});

test('deleting a contact can be undone', async ({ page }) => {
  await openContacts(page);
  await page.getByRole('button', { name: 'Delete City Hospital' }).click();
  await expect(page.getByRole('region', { name: 'City Hospital' })).toHaveCount(0);
  await expect(page.getByText('Deleted City Hospital')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('region', { name: 'City Hospital' })).toBeVisible();
});

test('an appointment with a contact takes their address and shows their phone', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Appointments', exact: true }).click();
  await page.getByRole('button', { name: 'Add appointment' }).click();
  const dialog = page.getByRole('dialog', { name: 'New appointment' });
  await dialog.getByLabel('What').fill('Newborn visit');
  await dialog.getByLabel('Who (optional)').selectOption({ label: 'Example Pediatrics (Pediatrician)' });
  await expect(dialog.getByLabel('Where (optional)')).toHaveValue('12 Example Street, Springfield');
  await dialog.getByRole('button', { name: 'Save' }).click();

  const row = page.locator('main li', { hasText: 'Newborn visit' });
  await expect(row).toContainText('Example Pediatrics');
  await expect(row.getByRole('link', { name: 'Call Example Pediatrics, (555) 010-0142' })).toHaveAttribute('href', 'tel:5550100142');
});

// The sample home is 12 Example Lane (39.7817, -89.6501); Example Pediatrics is 2.3 miles east.
test('the care team, their appointments and the map search say how far from home', async ({ page }) => {
  await stubOpenStreetMap(page, {
    search: [{ osm_type: 'node', osm_id: 1000031, lat: '39.7817', lon: '-89.6066', name: 'Example Lactation Clinic', display_name: 'Example Lactation Clinic, 14 Example Street, Springfield, 00000, United States', extratags: {} }],
  });
  await page.goto('./');
  // The next appointment, at the midwife's clinic: its place and, quietly, how far.
  await expect(page.getByRole('region', { name: 'Next appointment' })).toContainText('Riverside Family Clinic, room 4 · 1.7 mi from home');

  await page.getByRole('button', { name: 'Appointments', exact: true }).click();
  const row = (title: string) => page.locator('main li').filter({ has: page.getByText(title, { exact: true }) });
  await expect(row('Hospital tour')).toContainText('City Hospital, main entrance · 1.2 mi from home');
  // Not at a contact's place: no distance.
  await expect(row('Birth class, part 2')).not.toContainText('from home');

  await page.getByRole('button', { name: 'Checklists', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Paperwork' })).toContainText('2.3 mi from home');

  await page.getByRole('button', { name: 'Contacts', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Example Pediatrics' })).toContainText('2.3 mi from home');
  await page.getByRole('button', { name: 'Add contact' }).click();
  const dialog = page.getByRole('dialog', { name: 'New contact' });
  await dialog.getByLabel('Find a business').fill('lactation clinic');
  await dialog.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(dialog.getByRole('list', { name: 'Places' })).toContainText('Example Lactation Clinic');
  await expect(dialog.getByRole('list', { name: 'Places' })).toContainText('2.3 mi from home');
});
