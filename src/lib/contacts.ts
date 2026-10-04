import type { Contact } from '@huishouden/pwa-kit/contacts';
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

/** A known role's name in the page's language ("Pediatrician", "Pediatra", "Kinderarts"). */
export const roleLabel = (role: KnownRole): string => t(ROLE_KEYS[role]);

/** The one-tap roles in the page's language, for the contact dialog and grouping. */
export const roleLabels = (): string[] => ROLES.map(roleLabel);

// A role is stored as it was chosen or typed, in whichever language that was. These recognise it in
// English, Spanish and Dutch, so a contact saved on a Dutch phone groups under "Pediatra" on a Spanish one.
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
  return ROLES.find((r) => LANGS.some((l) => withLang(l, () => roleLabel(r)).toLowerCase() === typed)) ?? null;
}

/** Contacts whose role is a one-tap role, shown under that role's name in the page's language. */
export function withShownRoles(contacts: Contact[]): Contact[] {
  return contacts.map((c) => {
    const role = namedRole(c.role);
    return role ? { ...c, role: roleLabel(role) } : c;
  });
}
