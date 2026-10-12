import type { Firestore } from 'firebase/firestore';
import { localizeAgenda, syncAgenda } from '@huishouden/pwa-kit/agenda';
import { localizeReminders, syncReminders } from '@huishouden/pwa-kit/reminders';
import { localizeTodos, syncTodos } from '@huishouden/pwa-kit/todos';
import { agendaItems, tabUrl } from '../lib/agenda';
import { todoItems } from '../lib/todos';
import { appointmentReminders, kickReminders } from '../lib/reminders';
import { APP } from '../lib/contacts';
import type { BabyData } from '../lib/demo';

type PublishedStorage = NonNullable<Parameters<typeof syncAgenda>[4]['published']>;

export interface PublishOptions {
  /** The site's origin, for the deep links: `location.origin` in the app. */
  origin: string;
  now: number;
  /** A helper or kid: only open items are read and written. */
  restricted?: boolean;
  /** Where this device notes what it last published (default localStorage; null reads every time). */
  published?: PublishedStorage | null;
}

const opts = ({ now, restricted = false, published }: PublishOptions) => ({ now, restricted, ...(published === undefined ? {} : { published }) });

/** The due date and the appointments on the household agenda: one query of what Baby published (none when this device already published the same). */
export async function publishAgenda(db: Firestore, householdId: string, me: string, data: Pick<BabyData, 'profile' | 'appointments'>, o: PublishOptions) {
  const items = await localizeAgenda(() => agendaItems(data, o.origin));
  return syncAgenda(db, householdId, APP, items, { by: me, ...opts(o) });
}

/** The checklists' open items on the household's to-do list: one query, as `publishAgenda`. */
export async function publishTodos(db: Firestore, householdId: string, me: string, checklists: BabyData['checklists'], o: PublishOptions) {
  const items = await localizeTodos(() => todoItems(checklists, o.origin));
  return syncTodos(db, householdId, APP, items, { by: me, ...opts(o) });
}

/** The appointments' reminders and the daily kick-count reminder (admins and members): one query, as `publishAgenda`. */
export async function publishReminders(db: Firestore, householdId: string, me: string, data: Pick<BabyData, 'profile' | 'appointments' | 'kickSettings'>, o: Omit<PublishOptions, 'restricted'>) {
  const items = await localizeReminders(() => [
    ...appointmentReminders(data.appointments, data.profile, o.now, tabUrl(o.origin, 'appointments')),
    ...kickReminders(data.kickSettings, o.now, tabUrl(o.origin, 'kicks')),
  ]);
  return syncReminders(db, householdId, 'baby', items, me, o.now, o.published === undefined ? {} : { published: o.published });
}
