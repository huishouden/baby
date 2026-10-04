import { coordinates, type Contact } from '@huishouden/pwa-kit/contact-core';
import { formatFromHome, type HouseholdHome } from '@huishouden/pwa-kit/home';
import { LANGS, withLang } from '@huishouden/pwa-kit/i18n';
import { t } from '../i18n';

// The care team: which roles Baby knows about and how free-text roles and checklist items map onto
// them. Grouping, saving and the dialog are the kit's (@huishouden/pwa-kit/contacts, /react/contacts).

export const APP = 'baby';

/** Roles offered as one-tap choices, in the order the Contacts tab shows them. */
export const ROLES = ['pediatrician', 'midwife', 'hospital', 'lactation', 'doula'] as const;
export type KnownRole = (typeof ROLES)[number];

const ROLE_KEYS = {
  pediatrician: 'role.pediatrician',
  midwife: 'role.midwife',
  hospital: 'role.hospital',
  lactation: 'role.lactation',
  doula: 'role.doula',
} as const satisfies Record<KnownRole, string>;

/**
 * The one-tap roles as a contact stores them: in English, whoever picks them, so the household's
 * shared contacts group the same in every app and language (pwa-kit docs/i18n.md step 7).
 */
export const ROLE_NAMES = {
  pediatrician: 'Pediatrician',
  midwife: 'OB / midwife',
  hospital: 'Hospital',
  lactation: 'Lactation consultant',
  doula: 'Doula',
} as const satisfies Record<KnownRole, string>;

/** The stored names in the Contacts tab's order: `ContactDialog`'s and `groupContacts`' roles. */
export const STORED_ROLES: string[] = ROLES.map((r) => ROLE_NAMES[r]);

/** A known role's name in the page's language ("Pediatrician", "Pediatra", "Kinderarts"). */
export const roleLabel = (role: KnownRole): string => t(ROLE_KEYS[role]);

/** A stored role as shown: a one-tap role in the page's language, anything typed as typed. The kit's `roleLabel`. */
export function shownRole(stored: string): string {
  const role = ROLES.find((r) => ROLE_NAMES[r].toLowerCase() === stored.trim().toLowerCase());
  return role ? roleLabel(role) : stored;
}

// A typed role may be in any language. These recognise one in English, Spanish and Dutch ("Our
// midwife", "Kinderarts") for the checklist's "who is it" line.
const KEYWORDS: [KnownRole, RegExp][] = [
  ['pediatrician', /\b(p(a)?ediatric(ian)?s?|pediatras?|pediatría|kinderarts(en)?|consultatiebureau)\b/iu],
  ['lactation', /\b(lactation|lactancia|lactatie(kundige)?)/iu],
  ['doula', /\bdoulas?\b/iu],
  ['midwife', /\b(midwi(fe|ves)|ob|obgyn|ob-gyn|ob\/gyn|obstetrician|parteras?|matronas?|obstetras?|ginecólog[oa]s?|verloskundigen?|gynaecoloog)\b/iu],
  ['hospital', /\b(hospital(es)?|birth (center|centre)|ziekenhuis|kraamkliniek|geboortecentrum)\b/iu],
];

/** The known role a piece of text is about ("Our midwife" → midwife), or null. */
export function knownRole(text: string | undefined): KnownRole | null {
  if (!text) return null;
  for (const [role, re] of KEYWORDS) if (re.test(text)) return role;
  return null;
}

/**
 * The role a checklist item asks the household to choose, when it is about finding someone:
 * "Choose a pediatrician" → pediatrician. Hospitals are left out: "Pre-register at the
 * hospital" is not about choosing one.
 */
export function roleForChecklistItem(text: string): KnownRole | null {
  const role = knownRole(text);
  if (role === 'hospital') return null;
  if (role === 'midwife' && !/\b(midwi(fe|ves)|parteras?|matronas?|verloskundigen?)\b/iu.test(text)) return null;
  return role;
}

/** The first contact (by name) whose role is the given one, free-text roles included. */
export function contactForRole(contacts: Contact[], role: KnownRole): Contact | undefined {
  return [...contacts].sort((a, b) => a.name.localeCompare(b.name)).find((c) => knownRole(c.role) === role);
}

/**
 * The known role whose one-tap name `text` is, in any language ("Pediatrician", "Pediatra",
 * "Kinderarts"). A language whose messages are not loaded yet answers in English.
 */
export function namedRole(text: string | undefined): KnownRole | null {
  const typed = text?.trim().toLowerCase();
  if (!typed) return null;
  return ROLES.find((r) => ROLE_NAMES[r].toLowerCase() === typed || LANGS.some((l) => withLang(l, () => roleLabel(r)).toLowerCase() === typed)) ?? null;
}

/**
 * Contacts with a one-tap role saved under its name in another language (Baby 1.12.0 stored the
 * shown name) read as the stored English role, so they group with the rest.
 */
export function withStoredRoles(contacts: Contact[]): Contact[] {
  return contacts.map((c) => {
    const role = namedRole(c.role);
    return role && c.role !== ROLE_NAMES[role] ? { ...c, role: ROLE_NAMES[role] } : c;
  });
}

/** Contacts with their role as shown, for lists that print it ("Example Pediatrics (Pediatra)"). */
export function withShownRoles(contacts: Contact[]): Contact[] {
  return withStoredRoles(contacts).map((c) => (c.role ? { ...c, role: shownRole(c.role) } : c));
}

const plain = (text: string | undefined) => (text ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Where an appointment is, when that is its contact's place: no other location, the contact's
 * address (the dialog copies it in, cut to the field's length), or its name ("City Hospital, level
 * 2"). Undefined when the contact has no position or the appointment is somewhere else.
 */
export function appointmentPoint(location: string | undefined, contact: Contact | undefined): { lat: number; lng: number } | undefined {
  const point = coordinates(contact);
  if (!contact || !point) return undefined;
  const where = plain(location);
  if (!where) return point;
  const address = plain(contact.address);
  const name = plain(contact.name);
  const atAddress = !!address && (address.startsWith(where) || where.includes(address));
  const atName = !!name && (where === name || where.startsWith(`${name} `));
  return atAddress || atName ? point : undefined;
}

/** "2.3 mi from home" for an appointment at its contact's place, when the household has a home. */
export function appointmentFromHome(location: string | undefined, contact: Contact | undefined, { home, locale }: { home: HouseholdHome | undefined; locale?: string }): string | undefined {
  return formatFromHome(appointmentPoint(location, contact), { home, locale });
}
