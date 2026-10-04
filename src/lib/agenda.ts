import { allDayStart, type AgendaEdit, type AgendaInput } from '@huishouden/pwa-kit/agenda';
import type { CalendarEntry } from '@huishouden/pwa-kit/calendar-export';
import { appUrl, SUITE_ORIGIN } from '@huishouden/pwa-kit/site';
import { parseYmd } from '@huishouden/pwa-kit/time';
import type { Appointment, BabyProfile } from './model';
import type { BabyData } from './demo';
import { t } from '../i18n';

// What Baby puts on the household agenda (households/{id}/agenda), so the portal's calendar and
// Today view show it. Checklist items have no dates, so they are not published.

const BASE = import.meta.env.BASE_URL ?? '/baby/';
/** Where links point outside a page (tests); in the browser the page's origin, so staging links to staging. */
const ORIGIN = globalThis.location?.origin ?? SUITE_ORIGIN;

/** The app's address on the suite's one site; agenda links point into it. */
export const APP_URL = appUrl(BASE, '', ORIGIN);

export const appointmentRef = (id: string) => `appointment:${id}`;
export const DUE_DATE_REF = 'profile:dueDate';

/** The link that opens a tab of the app, on `origin`. */
export const tabUrl = (origin: string, tab?: string) => appUrl(BASE, tab ? `#${tab}` : '', origin);

const babyName = (profile: BabyProfile | null) => profile?.name?.trim() || undefined;

/**
 * How a change made in someone's own calendar (huishouden/calendar's Google sync) comes back to the
 * appointment: moved, renamed, new notes, or deleted. The same people the rules let change it:
 * admins and members, and whoever added it.
 */
export function appointmentEdit(a: Pick<Appointment, 'id' | 'by'>): AgendaEdit {
  const who = { roles: ['admin' as const, 'member' as const], emails: [a.by] };
  const merge = (data: object) => ({ ops: [{ col: 'babyAppointments', id: a.id, data, merge: true }], ...who });
  return {
    reschedule: merge({ at: '$start', updatedAt: '$now' }),
    rename: merge({ title: '$title', updatedAt: '$now' }),
    notes: merge({ notes: '$notes', updatedAt: '$now' }),
    cancel: { ops: [{ col: 'babyAppointments', id: a.id, data: null }], ...who },
  };
}

/** One timed item for an appointment, at its place, for the baby when the baby has a name. */
export function appointmentAgenda(a: Appointment, profile: BabyProfile | null, origin = ORIGIN): Omit<AgendaInput, 'ref'>[] {
  if (!a.title.trim() || !Number.isFinite(a.at)) return [];
  const location = a.location?.trim();
  const who = babyName(profile);
  return [
    {
      kind: 'appointment',
      title: a.title,
      start: a.at,
      allDay: false,
      ...(location ? { detail: location } : {}),
      url: tabUrl(origin, 'appointments'),
      ...(who ? { who } : {}),
      // A private appointment stays private on the household calendar too.
      private: a.private === true,
      edit: appointmentEdit(a),
    },
  ];
}

/** An appointment for "Add to calendar": what the agenda shows, at its place. */
export function appointmentEntry(a: Appointment, profile: BabyProfile | null): CalendarEntry | null {
  const [item] = appointmentAgenda(a, profile);
  if (!item) return null;
  const location = a.location?.trim();
  return { title: item.title, start: item.start, allDay: false, kind: 'appointment', url: item.url, ...(a.notes?.trim() ? { detail: a.notes.trim() } : {}), ...(location ? { location } : {}) };
}

/** The due date for "Add to calendar". */
export function dueDateEntry(profile: BabyProfile | null): CalendarEntry | null {
  const [item] = dueDateAgenda(profile);
  return item ? { title: item.title, start: item.start, allDay: true, kind: 'other', url: item.url } : null;
}

/** The due date as an all-day item, until the baby is born. */
export function dueDateAgenda(profile: BabyProfile | null, origin = ORIGIN): Omit<AgendaInput, 'ref'>[] {
  if (!profile?.dueDate || profile.birthDate || parseYmd(profile.dueDate) === null) return [];
  const who = babyName(profile);
  return [{ kind: 'other', title: t('profile.dueDate'), start: allDayStart(profile.dueDate), allDay: true, url: tabUrl(origin), ...(who ? { who } : {}) }];
}

/**
 * Everything Baby publishes, for reconciling on open, in the page's language (wrap in
 * `localizeAgenda` for every language). The kit leaves out what falls outside its window.
 */
export function agendaItems(data: Pick<BabyData, 'profile' | 'appointments'>, origin = ORIGIN): AgendaInput[] {
  return [
    ...dueDateAgenda(data.profile, origin).map((i) => ({ ...i, ref: DUE_DATE_REF })),
    ...data.appointments.flatMap((a) => appointmentAgenda(a, data.profile, origin).map((i) => ({ ...i, ref: appointmentRef(a.id) }))),
  ];
}
