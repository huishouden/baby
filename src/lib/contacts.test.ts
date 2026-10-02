import { describe, expect, test } from 'bun:test';
import type { Contact } from '@huishouden/pwa-kit/contacts';
import { DEFAULT_CHECKLISTS } from './checklist';
import { groupContacts } from '@huishouden/pwa-kit/contacts';
import { ROLES, contactForRole, knownRole, roleForChecklistItem } from './contacts';

const contact = (name: string, role?: string): Contact => ({ id: name, name, role, apps: ['baby'], createdAt: 1, by: 'sam@example.com' });

describe('checklist items about choosing someone', () => {
  test.each([
    ['Choose a pediatrician', 'Pediatrician'],
    ['Find a lactation consultant', 'Lactation consultant'],
    ['Interview doulas', 'Doula'],
    ['Book a midwife', 'OB / midwife'],
    ['Pick a paediatrician near work', 'Pediatrician'],
  ])('"%s" asks for a %s', (text, role) => expect(roleForChecklistItem(text)).toBe(role as never));

  test.each(['Pre-register at the hospital', 'Install the car seat', 'Ask the OB about the birth plan', 'Diapers and wipes'])('"%s" is not about choosing someone', (text) =>
    expect(roleForChecklistItem(text)).toBeNull(),
  );

  test('the default lists have exactly one such item', () => {
    const all = DEFAULT_CHECKLISTS.flatMap((l) => l.items);
    expect(all.filter((t) => roleForChecklistItem(t))).toEqual(['Choose a pediatrician']);
  });
});

describe('roles', () => {
  test('free-text roles map onto the known ones', () => {
    expect(knownRole('Our midwife')).toBe('OB / midwife');
    expect(knownRole('OB-GYN')).toBe('OB / midwife');
    expect(knownRole('Pediatrics')).toBe('Pediatrician');
    expect(knownRole('Birth center')).toBe('Hospital');
    expect(knownRole('Night nanny')).toBeNull();
    expect(knownRole(undefined)).toBeNull();
  });

  test('the contact for a role is found through free-text roles too, first by name', () => {
    const list = [contact('Zed Kids Clinic', 'Pediatrics'), contact('Example Pediatrics', 'Pediatrician'), contact('Riverside', 'Our midwife')];
    expect(contactForRole(list, 'Pediatrician')?.name).toBe('Example Pediatrics');
    expect(contactForRole(list, 'OB / midwife')?.name).toBe('Riverside');
    expect(contactForRole(list, 'Doula')).toBeUndefined();
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
    ROLES,
  );
  expect(groups.map((g) => g.role)).toEqual(['Pediatrician', 'Hospital', 'Backup driver', 'Night nanny', 'Other']);
  expect(groups[0].contacts.map((c) => c.name)).toEqual(['A Peds', 'C Peds']);
});
