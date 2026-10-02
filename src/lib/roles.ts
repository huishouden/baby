import { can, type Role } from '@huishouden/pwa-kit/roles';

/**
 * What the signed-in person may change (pwa-kit STANDARD.md "Roles"): admins and members anything,
 * helpers and kids only what they added. The rules enforce the same; this hides what they'd refuse.
 */
export function mayChange(role: Role | null, me: string, record: { by?: string }): boolean {
  return can(role, 'edit-others') || (!!me && record.by === me);
}
