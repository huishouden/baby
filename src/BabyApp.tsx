import { useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import type { Contact } from '@huishouden/pwa-kit/contacts';
import type { Appointment } from './lib/model';
import { useClock } from '@huishouden/pwa-kit/react/clock';
import { calendarAvailable } from '@huishouden/pwa-kit/react/calendar';
import { ContactDialog } from '@huishouden/pwa-kit/react/contacts';
import { Toast, type ToastState } from '@huishouden/pwa-kit/react/ui';
import type { BabyStore } from './data/types';
import { Header, type Tab } from './components/Header';
import { ProfileDialog, type ProfileMode } from './components/ProfileDialog';
import { AppointmentDialog } from './components/AppointmentDialog';
import { APP, ROLES } from './lib/contacts';
import { LogScreen } from './screens/LogScreen';
import { Overview } from './screens/Overview';
import { Appointments } from './screens/Appointments';
import { Checklists } from './screens/Checklists';
import { Contacts } from './screens/Contacts';

type TabId = 'home' | 'appointments' | 'checklists' | 'contacts';

interface Props {
  store: BabyStore;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  signingIn: boolean;
  toast: ToastState | null;
  notify: (message: string, undo?: () => void) => void;
  clearToast: () => void;
  /** Shown above the content: the sample-data banner. */
  banner?: ReactNode;
  initialTab?: TabId;
}

/** Everything inside the frame once there is data to show (live or sample). */
export function BabyApp({ store, user, onSignIn, onSignOut, signingIn, toast, notify, clearToast, banner, initialTab = 'home' }: Props) {
  const { now } = useClock();
  const [tab, setTab] = useState<TabId>(initialTab);
  const [profileMode, setProfileMode] = useState<ProfileMode | null>(null);
  const [appointment, setAppointment] = useState<Appointment | 'new' | null>(null);
  const [contact, setContact] = useState<{ contact: Contact | null; role?: string } | null>(null);
  const { profile } = store.data;
  const born = !!profile?.birthDate;
  const calendar = calendarAvailable(user);

  useEffect(() => {
    document.title = 'Huishouden Baby';
  }, []);

  const tabs: Tab[] = [
    { id: 'home', label: born ? 'Log' : 'Overview' },
    { id: 'appointments', label: 'Appointments' },
    { id: 'checklists', label: 'Checklists' },
    { id: 'contacts', label: 'Contacts' },
  ];

  let content: ReactNode;
  if (!store.ready) content = <p className="p-2 text-lg text-stone-600">Loading the baby's details</p>;
  else if (tab === 'appointments')
    content = <Appointments store={store} calendarAvailable={calendar} onAdd={() => setAppointment('new')} onEdit={setAppointment} notify={notify} />;
  else if (tab === 'checklists') content = <Checklists store={store} notify={notify} onAddContact={(role) => setContact({ contact: null, role })} />;
  else if (tab === 'contacts')
    content = <Contacts store={store} notify={notify} onAdd={() => setContact({ contact: null })} onEdit={(c) => setContact({ contact: c })} />;
  else if (born) content = <LogScreen store={store} notify={notify} onEditProfile={() => setProfileMode('edit')} />;
  else
    content = (
      <Overview
        store={store}
        onSetDueDate={() => setProfileMode('due')}
        onBabyIsHere={() => setProfileMode('born')}
        onAddAppointment={() => setAppointment('new')}
        onEditAppointment={setAppointment}
        onOpen={setTab}
      />
    );

  return (
    <div className="flex min-h-dvh flex-col bg-cream font-sans text-stone-800 antialiased lg:h-dvh lg:overflow-hidden">
      <Header tabs={tabs} tab={tab} onTab={(id) => setTab(id as TabId)} user={user} onSignIn={onSignIn} onSignOut={onSignOut} signingIn={signingIn} />
      <main className="mx-auto flex w-full max-w-[1200px] min-h-0 flex-1 flex-col gap-4 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 sm:pb-6">
        {banner}
        <div className="min-h-0 flex-1">{content}</div>
      </main>

      {profileMode && (
        <ProfileDialog
          mode={profileMode}
          profile={profile}
          now={now}
          onClose={() => setProfileMode(null)}
          onSave={(p) => {
            const before = profile;
            store.actions.saveProfile(p);
            if (profileMode === 'born') {
              setTab('home');
              notify(p.name?.trim() ? `Welcome, ${p.name.trim()}. The log is ready.` : 'The log is ready.', before ? () => store.actions.saveProfile(before) : undefined);
            }
          }}
        />
      )}
      {appointment && (
        <AppointmentDialog
          appointment={appointment === 'new' ? null : appointment}
          now={now}
          contacts={store.data.contacts}
          calendarAvailable={calendar}
          onClose={() => setAppointment(null)}
          onSave={(input) => store.actions.saveAppointment(appointment === 'new' ? null : appointment.id, input)}
          onDelete={
            appointment === 'new'
              ? undefined
              : () => {
                  const gone = appointment;
                  store.actions.deleteAppointment(gone.id);
                  notify(`Deleted ${gone.title}`, () => store.actions.restoreAppointment(gone));
                }
          }
        />
      )}
      {contact && (
        <ContactDialog
          contact={contact.contact}
          app={APP}
          roles={ROLES}
          role={contact.role}
          searchPlaceholder="Practice name and town"
          namePlaceholder="Example Pediatrics"
          onClose={() => setContact(null)}
          onSave={(input) => {
            store.actions.saveContact(contact.contact?.id ?? null, input);
            if (!contact.contact) notify(`Added ${input.name}`);
          }}
          onDelete={
            contact.contact
              ? () => {
                  const gone = contact.contact!;
                  store.actions.deleteContact(gone.id);
                  notify(`Deleted ${gone.name}`, () => store.actions.restoreContact(gone));
                }
              : undefined
          }
        />
      )}
      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}
