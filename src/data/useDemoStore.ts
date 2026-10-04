import { useEffect, useMemo } from 'react';
import { setHome } from '@huishouden/pwa-kit/home';
import { sampleContacts } from '@huishouden/pwa-kit/contacts';
import { localIds } from '@huishouden/pwa-kit/store';
import { useSampleStore } from '@huishouden/pwa-kit/react/store';
import { DEMO_HOME, DEMO_MEMBERS, demoData, type BabyData, type DemoScenario } from '../lib/demo';
import { createActions, type Backend, type DataKey } from './actions';
import type { BabyStore } from './types';
import type { Role } from '@huishouden/pwa-kit/roles';

/** A helper for the sample (`?as=helper`), someone the sample's entries don't belong to. */
export const DEMO_HELPER = 'jo@example.com';

/**
 * Sample data kept in memory: the signed-out app is fully clickable, nothing is saved, and a reload
 * starts over. `clock` is the demo's moving "now" (fixed 2031 start plus time since load).
 */
export function useDemoStore(scenario: DemoScenario, clock: () => number, role: Role = 'admin'): BabyStore {
  const helper = role === 'helper' || role === 'kid';
  const { data, read, patch, backend: memory } = useSampleStore<BabyData, DataKey>(() => {
    const d = demoData(scenario);
    // A helper's view: what the rules would let them read (no private appointments or contacts).
    return helper ? { ...d, appointments: d.appointments.filter((a) => !a.private), contacts: d.contacts.filter((c) => !c.private) } : d;
  });
  const me = helper ? DEMO_HELPER : DEMO_MEMBERS[0];
  // The sample's own home while it shows, so distances read as they would at home; gone on sign-in.
  useEffect(() => {
    setHome(DEMO_HOME);
    return () => setHome(undefined);
  }, []);

  const actions = useMemo(() => {
    const backend: Backend = {
      ...memory,
      saveProfile: (profile) => patch((d) => ({ ...d, profile })),
      contacts: sampleContacts(() => read().contacts, (contacts) => patch((d) => ({ ...d, contacts })), { by: me, now: clock, newId: localIds() }),
    };
    return createActions(backend, read, me, clock);
  }, [clock, me, memory, patch, read]);

  return { data, ready: true, actions, members: helper ? [...DEMO_MEMBERS, DEMO_HELPER] : DEMO_MEMBERS, me, role };
}
