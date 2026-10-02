import type { Contact } from '@huishouden/pwa-kit/contacts';

// The care team: which roles Baby knows about and how free-text roles and checklist items map onto
// them. Grouping, saving and the dialog are the kit's (@huishouden/pwa-kit/contacts, /react/contacts).

export const APP = 'baby';

/** Roles offered as one-tap choices, in the order the Contacts tab shows them. */
export const ROLES = ['Pediatrician', 'OB / midwife', 'Hospital', 'Lactation consultant', 'Doula'] as const;
export type KnownRole = (typeof ROLES)[number];

const KEYWORDS: [KnownRole, RegExp][] = [
  ['Pediatrician', /\bp(a)?ediatric(ian)?s?\b/i],
  ['Lactation consultant', /\blactation\b/i],
  ['Doula', /\bdoulas?\b/i],
  ['OB / midwife', /\b(midwi(fe|ves)|ob|obgyn|ob-gyn|ob\/gyn|obstetrician)\b/i],
  ['Hospital', /\b(hospital|birth (center|centre))\b/i],
];

/** The known role a piece of text is about ("Our midwife" → "OB / midwife"), or null. */
export function knownRole(text: string | undefined): KnownRole | null {
  if (!text) return null;
  for (const [role, re] of KEYWORDS) if (re.test(text)) return role;
  return null;
}

/**
 * The role a checklist item asks the household to choose, when it is about finding someone:
 * "Choose a pediatrician" → "Pediatrician". Hospitals are left out: "Pre-register at the
 * hospital" is not about choosing one.
 */
export function roleForChecklistItem(text: string): KnownRole | null {
  const role = knownRole(text);
  if (role === 'Hospital') return null;
  if (role === 'OB / midwife' && !/\bmidwi(fe|ves)\b/i.test(text)) return null;
  return role;
}

/** The first contact (by name) whose role is the given one, free-text roles included. */
export function contactForRole(contacts: Contact[], role: KnownRole): Contact | undefined {
  return [...contacts].sort((a, b) => a.name.localeCompare(b.name)).find((c) => knownRole(c.role) === role || c.role?.trim().toLowerCase() === role.toLowerCase());
}
