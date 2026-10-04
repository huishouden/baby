import { allDayStart, type AgendaInput } from '@huishouden/pwa-kit/agenda';
import { appUrl } from '@huishouden/pwa-kit/site';
import { parseYmd } from '@huishouden/pwa-kit/time';
import type { Appointment, BabyProfile } from './model';
import type { BabyData } from './demo';
import { t } from '../i18n';

// What Baby puts on the household agenda (households/{id}/agenda), so the portal's calendar and
// Today view show it. Checklist items have no dates, so they are not published.

const BASE = import.meta.env.BASE_URL ?? '/baby/';
/** Where links point outside a page (tests); in the browser the page's origin, so staging links to staging. */
const ORIGIN = globalThis.location?.origin ?? 'https://huishouden-piekstra.web.app';

/** The app's address on the suite's one site; agenda links point into it. */
export const APP_URL = appUrl(BASE, '', ORIGIN);

export const appointmentRef = (id: string) => `appointment:${id}`;
export const DUE_DATE_REF = 'profile:dueDate';

/** The link that opens a tab of the app, on `origin`. */
export const tabUrl = (origin: string, tab?: string) => appUrl(BASE, tab ? `#${tab}` : '', origin);

const babyName = (profile: BabyProfile | null) => profile?.name?.trim() || undefined;

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
    },
  ];
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
