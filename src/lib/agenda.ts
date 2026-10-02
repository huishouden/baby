import { allDayStart, type AgendaInput } from '@huishouden/pwa-kit/agenda';
import { parseYmd } from '@huishouden/pwa-kit/time';
import type { Appointment, BabyProfile } from './model';
import type { BabyData } from './demo';

// What Baby puts on the household agenda (households/{id}/agenda), so the portal's calendar and
// Today view show it. Checklist items have no dates, so they are not published.

/** The app's public address; agenda links point into it. */
export const APP_URL = 'https://huishouden-baby.web.app';

export const appointmentRef = (id: string) => `appointment:${id}`;
export const DUE_DATE_REF = 'profile:dueDate';

/** The link that opens a tab of the app. */
export const tabUrl = (appUrl: string, tab?: string) => (tab ? `${appUrl}/#${tab}` : `${appUrl}/`);

const babyName = (profile: BabyProfile | null) => profile?.name?.trim() || undefined;

/** One timed item for an appointment, at its place, for the baby when the baby has a name. */
export function appointmentAgenda(a: Appointment, profile: BabyProfile | null, appUrl = APP_URL): Omit<AgendaInput, 'ref'>[] {
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
      url: tabUrl(appUrl, 'appointments'),
      ...(who ? { who } : {}),
      // A private appointment stays private on the household calendar too.
      private: a.private === true,
    },
  ];
}

/** The due date as an all-day item, until the baby is born. */
export function dueDateAgenda(profile: BabyProfile | null, appUrl = APP_URL): Omit<AgendaInput, 'ref'>[] {
  if (!profile?.dueDate || profile.birthDate || parseYmd(profile.dueDate) === null) return [];
  const who = babyName(profile);
  return [{ kind: 'other', title: 'Due date', start: allDayStart(profile.dueDate), allDay: true, url: tabUrl(appUrl), ...(who ? { who } : {}) }];
}

/** Everything Baby publishes, for reconciling on open. The kit leaves out what falls outside its window. */
export function agendaItems(data: Pick<BabyData, 'profile' | 'appointments'>, appUrl = APP_URL): AgendaInput[] {
  return [
    ...dueDateAgenda(data.profile, appUrl).map((i) => ({ ...i, ref: DUE_DATE_REF })),
    ...data.appointments.flatMap((a) => appointmentAgenda(a, data.profile, appUrl).map((i) => ({ ...i, ref: appointmentRef(a.id) }))),
  ];
}
