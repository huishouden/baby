import { afterEach, describe, expect, test } from 'bun:test';
import { setLangForTests } from '@huishouden/pwa-kit/i18n';
import type { Contact } from '@huishouden/pwa-kit/contacts';
import { defaultChecklists } from './checklist';
import { groupContacts } from '@huishouden/pwa-kit/contacts';
import { DEMO_HOME, demoData } from './demo';
import { STORED_ROLES, appointmentFromHome, appointmentPoint, contactForRole, knownRole, namedRole, roleForChecklistItem, shownRole, withShownRoles, withStoredRoles } from './contacts';

// Back to English the way the app would switch (resetI18nForTests would forget the app's catalogue).
afterEach(() => setLangForTests('en'));

const contact = (name: string, role?: string): Contact => ({ id: name, name, role, apps: ['baby'], createdAt: 1, by: 'sam@example.com' });

describe('checklist items about choosing someone', () => {
  test.each([
    ['Choose a pediatrician', 'pediatrician'],
    ['Find a lactation consultant', 'lactation'],
    ['Interview doulas', 'doula'],
    ['Book a midwife', 'midwife'],
    ['Pick a paediatrician near work', 'pediatrician'],
  ])('"%s" asks for a %s', (text, role) => expect(roleForChecklistItem(text)).toBe(role as never));

  test.each(['Pre-register at the hospital', 'Install the car seat', 'Ask the OB about the birth plan', 'Diapers and wipes'])('"%s" is not about choosing someone', (text) =>
    expect(roleForChecklistItem(text)).toBeNull(),
  );

  test('the default lists have exactly one such item', () => {
    const all = defaultChecklists().flatMap((l) => l.items);
    expect(all.filter((t) => roleForChecklistItem(t))).toEqual(['Choose a pediatrician']);
  });

  test.each([
    ['es', 'Elegir un pediatra', 'pediatrician'],
    ['nl', 'Een kinderarts kiezen', 'pediatrician'],
  ] as const)('the %s starter lists keep the pediatrician link: "%s"', async (lang, text, role) => {
    await setLangForTests(lang);
    const all = defaultChecklists().flatMap((l) => l.items);
    expect(all.filter((t) => roleForChecklistItem(t))).toEqual([text]);
    expect(roleForChecklistItem(text)).toBe(role);
  });

  test.each([
    ['Buscar una asesora de lactancia', 'lactation'],
    ['Buscar una partera', 'midwife'],
    ['Een verloskundige zoeken', 'midwife'],
    ['Een lactatiekundige zoeken', 'lactation'],
  ])('"%s" asks for a %s', (text, role) => expect(roleForChecklistItem(text)).toBe(role as never));
});

describe('roles', () => {
  test('free-text roles map onto the known ones', () => {
    expect(knownRole('Our midwife')).toBe('midwife');
    expect(knownRole('OB-GYN')).toBe('midwife');
    expect(knownRole('Pediatrics')).toBe('pediatrician');
    expect(knownRole('Birth center')).toBe('hospital');
    expect(knownRole('Ziekenhuis')).toBe('hospital');
    expect(knownRole('Ginecóloga')).toBe('midwife');
    expect(knownRole('Night nanny')).toBeNull();
    expect(knownRole(undefined)).toBeNull();
  });

  test('the contact for a role is found through free-text roles too, first by name', () => {
    const list = [contact('Zed Kids Clinic', 'Pediatrics'), contact('Example Pediatrics', 'Pediatrician'), contact('Riverside', 'Our midwife')];
    expect(contactForRole(list, 'pediatrician')?.name).toBe('Example Pediatrics');
    expect(contactForRole(list, 'midwife')?.name).toBe('Riverside');
    expect(contactForRole(list, 'doula')).toBeUndefined();
  });
});

test('groups put known roles first, free-text roles next, no role last as Other', () => {
  const groups = groupContacts(
    [
      contact('B Hospital', 'Hospital'),
      contact('Night help', 'Night nanny'),
      contact('A Peds', 'pediatrician'),
      contact('Plumber'),
      contact('C Peds', 'Pediatrician'),
      contact('Aunt', 'Backup driver'),
    ],
    STORED_ROLES,
  );
  expect(groups.map((g) => g.role)).toEqual(['Pediatrician', 'Hospital', 'Backup driver', 'Night nanny', 'Other']);
  expect(groups[0].contacts.map((c) => c.name)).toEqual(['A Peds', 'C Peds']);
});

test('a one-tap role is stored in English and shown in the page language, also when saved under another language’s name', async () => {
  await setLangForTests('es');
  const list = [contact('A Peds', 'Pediatrician'), contact('B Peds', 'Kinderarts'), contact('C Peds', 'Pediatric dentist'), contact('Hosp', 'Ziekenhuis')];
  expect(namedRole('kinderarts')).toBe('pediatrician');
  expect(namedRole('Pediatric dentist')).toBeNull();
  const groups = groupContacts(withStoredRoles(list), STORED_ROLES, shownRole);
  // Grouped by the stored English role, shown in the page's language.
  expect(groups.map((g) => g.role)).toEqual(['Pediatrician', 'Hospital', 'Pediatric dentist']);
  expect(groups.map((g) => shownRole(g.role))).toEqual(['Pediatra', 'Hospital', 'Pediatric dentist']);
  expect(withShownRoles([contact('X', 'Kinderarts')])[0].role).toBe('Pediatra');
  expect(groups[0].contacts.map((c) => c.name)).toEqual(['A Peds', 'B Peds']);
});

describe('how far an appointment is from home', () => {
  const home = DEMO_HOME;
  const { contacts } = demoData('before');
  const peds = contacts.find((x) => x.role === 'Pediatrician')!;
  const hospital = contacts.find((x) => x.role === 'Hospital')!;
  const noPosition: Contact = { ...peds, lat: undefined, lng: undefined };

  test('at the contact, by its address, its name, a part of it, or no location at all', () => {
    expect(appointmentFromHome('12 Example Street, Springfield', peds, { home, locale: 'en-US' })).toBe('2.3 mi from home');
    expect(appointmentFromHome('12 example street', peds, { home, locale: 'en-US' })).toBe('2.3 mi from home');
    expect(appointmentFromHome('Example Pediatrics', peds, { home, locale: 'en-US' })).toBe('2.3 mi from home');
    expect(appointmentFromHome('City Hospital, level 2', hospital, { home, locale: 'en-US' })).toBe('1.2 mi from home');
    expect(appointmentFromHome(undefined, peds, { home, locale: 'nl-NL' })).toBe('3,7 km from home');
  });

  test('nothing when it is somewhere else, the contact has no position, or there is no home', () => {
    expect(appointmentFromHome('Community centre, room B', peds, { home })).toBeUndefined();
    expect(appointmentFromHome('City Hospitality Suites', hospital, { home })).toBeUndefined();
    expect(appointmentFromHome(undefined, noPosition, { home })).toBeUndefined();
    expect(appointmentFromHome(undefined, undefined, { home })).toBeUndefined();
    expect(appointmentFromHome(undefined, peds, { home: undefined })).toBeUndefined();
  });

  test('the point is the contact’s own position', () => {
    expect(appointmentPoint(undefined, peds)).toEqual({ lat: 39.7817, lng: -89.6066 });
  });
});
