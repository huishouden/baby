import type { ReminderInput, ReminderSource } from '@huishouden/pwa-kit/reminders';
import { DAY, HOUR, formatTime, toYmd } from '@huishouden/pwa-kit/time';
import type { Appointment, BabyProfile, KickSettings } from './model';
import { kickReminderRef, kickReminderSource, kickReminders as kitKickReminders } from '@huishouden/pwa-kit/baby-settings';
import { atLocal } from './kicks';
import { t } from '../i18n';

// What Baby asks the household's push sender to remind about: each appointment, the day before and
// two hours before. They are scheduled in Firestore (households/{id}/reminders) and sent by the
// shared sender (huishouden/notify) to every device with notifications on.

/** How long before an appointment each reminder is sent, and the title that says so. */
const LEADS = [
  { key: 'day', ms: DAY, title: 'reminder.dayBefore' },
  { key: 'soon', ms: 2 * HOUR, title: 'reminder.soon' },
] as const;

export const reminderRef = (id: string, key: (typeof LEADS)[number]['key']) => `appointment:${id}:${key}`;

/** Every reminder ref an appointment can have, to clear them when it goes. */
export const reminderRefs = (id: string) => LEADS.map((l) => reminderRef(id, l.key));

/** Due while the appointment exists and is still at that time: deleting or moving it cancels the reminder unsent. */
export const reminderSource = (a: Pick<Appointment, 'id' | 'at'>): ReminderSource => ({
  checks: [{ doc: `babyAppointments/${a.id}`, due: [{ field: 'at', in: [Math.round(a.at)] }] }],
});

/**
 * The reminders for the appointments that haven't had theirs turned off (`remind: false`), each at
 * its time before the appointment and only when that time is still to come. Words in the current
 * language (wrap in `localizeReminders` for all of them). A private appointment's reminders are private.
 * `withSource` is false on a helper's or kid's device: the kit lets only admins and members attach it.
 */
export function appointmentReminders(appointments: Appointment[], profile: BabyProfile | null, now: number, url: string, withSource = true): ReminderInput[] {
  const name = profile?.name?.trim() || '';
  const out: ReminderInput[] = [];
  for (const a of appointments) {
    const title = a.title?.trim();
    if (!title || !Number.isFinite(a.at) || a.remind === false) continue;
    const place = a.location?.trim() || '';
    const body = t(name ? (place ? 'reminder.whenWhoWhere' : 'reminder.whenWho') : place ? 'reminder.whenWhere' : 'reminder.when', { time: formatTime(a.at), name, place });
    for (const lead of LEADS) {
      const at = Math.round(a.at) - lead.ms;
      if (at <= now) continue;
      out.push({
        app: 'baby',
        title: t(lead.title, { title }),
        body,
        at,
        url,
        recipients: 'all',
        ref: reminderRef(a.id, lead.key),
        private: a.private === true,
        ...(withSource ? { source: reminderSource(a) } : {}),
      });
    }
  }
  return out;
}

export { kickReminderRef, kickReminderSource };

/**
 * The daily "time for a kick count" reminder, at the chosen time (this device's clock) on each of
 * the next days still to come: the kit's `kickReminders`, which the assistant's tool writes too, so
 * the two agree on ids, refs and sources. Private (admins and members; kids have no kick counter).
 * `withSource` is false on a device that may not attach one (the kit lets only admins and members).
 */
export function kickReminders(settings: Pick<KickSettings, 'remindAt'> | null, now: number, url: string, withSource = true): ReminderInput[] {
  return kitKickReminders(settings?.remindAt, { today: toYmd(now), now, at: atLocal, url, title: t('reminder.kicks.title'), body: t('reminder.kicks.body'), withSource });
}
