import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { addContact, removeContactFromApp, restoreContact, updateContact, watchContacts, type Contact } from '@huishouden/pwa-kit/contacts';
import type { Appointment, BabyEvent, BabyProfile, ChecklistItem } from '../lib/model';
import { APP } from '../lib/contacts';
import { cleanEvent } from '../lib/model';
import { defaultChecklistDocs, nextOrder } from '../lib/checklist';
import { DAY } from '../lib/time';
import { db } from './firebase';
import { appointmentDoc, eventFields, newEventDoc, profileDoc } from './build';
import type { BabyActions, BabyStore } from './types';

/** How far back the log reads: enough for the day picker, small enough to stay fast. */
const HISTORY_DAYS = 14;

const withoutId = <T extends { id: string }>({ id: _id, ...rest }: T) => rest;

/**
 * Live household data from Firestore with onSnapshot listeners. Writes are fire-and-forget: the
 * persistent cache applies them locally at once (also offline) and syncs later.
 */
export function useLiveStore(householdId: string, me: string, members: string[], onError: (message: string) => void): BabyStore {
  const [profile, setProfile] = useState<BabyProfile | null>(null);
  const [events, setEvents] = useState<BabyEvent[]>([]);
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const contactsRef = useRef<Contact[]>([]);
  contactsRef.current = contacts;
  const [answered, setAnswered] = useState({ profile: false, checklists: false });
  const checklistRef = useRef<ChecklistItem[]>([]);
  checklistRef.current = checklists;
  const appointmentsRef = useRef<Appointment[]>([]);
  appointmentsRef.current = appointments;
  const errorRef = useRef(onError);
  errorRef.current = onError;

  const base = `households/${householdId}`;

  useEffect(() => {
    const fail = (what: string) => (e: Error) => errorRef.current(readError(e, `Couldn't load ${what}`));
    const since = Date.now() - HISTORY_DAYS * DAY;
    const unsubs = [
      onSnapshot(
        doc(db, base, 'babyProfile', 'main'),
        (s) => {
          setProfile(s.exists() ? (s.data() as BabyProfile) : null);
          setAnswered((a) => ({ ...a, profile: true }));
        },
        (e) => {
          setAnswered((a) => ({ ...a, profile: true }));
          fail('the baby details')(e);
        },
      ),
      onSnapshot(
        query(collection(db, base, 'babyEvents'), where('at', '>=', since)),
        (s) => setEvents(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BabyEvent, 'id'>) }))),
        fail('the log'),
      ),
      onSnapshot(
        collection(db, base, 'babyChecklists'),
        (s) => {
          setChecklists(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChecklistItem, 'id'>) })));
          setAnswered((a) => ({ ...a, checklists: true }));
          // First visit for this household: start the checklists with sensible defaults. Stable ids
          // make a second device seeding at the same moment harmless.
          const key = `baby-seeded-${householdId}`;
          if (s.empty && !s.metadata.fromCache && !localStorage.getItem(key)) {
            localStorage.setItem(key, '1');
            const batch = writeBatch(db);
            for (const { id, data } of defaultChecklistDocs(Date.now(), me)) batch.set(doc(db, base, 'babyChecklists', id), data);
            batch.commit().catch((e) => {
              localStorage.removeItem(key);
              errorRef.current(readError(e, "Couldn't add the starter checklists"));
            });
          } else if (!s.empty) localStorage.setItem(key, '1');
        },
        (e) => {
          setAnswered((a) => ({ ...a, checklists: true }));
          fail('the checklists')(e);
        },
      ),
      onSnapshot(
        collection(db, base, 'babyAppointments'),
        (s) => setAppointments(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Appointment, 'id'>) }))),
        fail('the appointments'),
      ),
      watchContacts(db, householdId, setContacts, { app: APP, onError: fail('the contacts') }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [base, householdId, me]);

  const actions = useMemo<BabyActions>(() => {
    const report = (p: Promise<unknown>) => void p.catch((e) => errorRef.current(readError(e, "Couldn't save")));
    const col = (name: string) => collection(db, base, name);
    return {
      saveProfile: (p) => report(setDoc(doc(db, base, 'babyProfile', 'main'), profileDoc(p, me, Date.now()))),
      logEvent: (f) => {
        const now = Date.now();
        const data = newEventDoc({ ...f, at: f.at ?? now }, me, now);
        const ref = doc(col('babyEvents'));
        report(setDoc(ref, data));
        return { id: ref.id, ...data };
      },
      updateEvent: (event, f) =>
        report(setDoc(doc(col('babyEvents'), event.id), cleanEvent({ ...eventFields(f), by: event.by, createdAt: event.createdAt, updatedAt: Date.now() }))),
      deleteEvent: (id) => report(deleteDoc(doc(col('babyEvents'), id))),
      restoreEvent: (e) => report(setDoc(doc(col('babyEvents'), e.id), cleanEvent(withoutId(e)))),
      addChecklistItem: (list, text) => {
        const t = text.trim().slice(0, 200);
        const l = list.trim().slice(0, 60);
        if (!t || !l) return;
        report(setDoc(doc(col('babyChecklists')), { list: l, text: t, done: false, order: nextOrder(checklistRef.current, l), createdAt: Date.now(), by: me }));
      },
      setChecklistDone: (id, done) => report(updateDoc(doc(col('babyChecklists'), id), { done })),
      deleteChecklistItem: (id) => report(deleteDoc(doc(col('babyChecklists'), id))),
      restoreChecklistItem: (item) => report(setDoc(doc(col('babyChecklists'), item.id), withoutId(item))),
      reorderChecklist: (writes) => {
        const batch = writeBatch(db);
        for (const w of writes) batch.update(doc(col('babyChecklists'), w.id), { order: w.order });
        report(batch.commit());
      },
      saveAppointment: (id, input) => {
        const existing = id ? appointmentsRef.current.find((a) => a.id === id) : undefined;
        const ref = id ? doc(col('babyAppointments'), id) : doc(col('babyAppointments'));
        report(setDoc(ref, appointmentDoc(input, existing?.by ?? me, existing?.createdAt ?? Date.now())));
      },
      deleteAppointment: (id) => report(deleteDoc(doc(col('babyAppointments'), id))),
      restoreAppointment: (a) => report(setDoc(doc(col('babyAppointments'), a.id), withoutId(a))),
      saveContact: (id, input) => report(id ? updateContact(db, householdId, id, input, me) : addContact(db, householdId, input, me)),
      deleteContact: (id) => {
        const c = contactsRef.current.find((x) => x.id === id);
        // A contact other apps also show stays for them; Baby only stops showing it.
        if (c) report(removeContactFromApp(db, householdId, c, APP, me));
      },
      restoreContact: (c) => report(restoreContact(db, householdId, c)),
    };
  }, [base, householdId, me]);

  return {
    data: { profile, events, checklists, appointments, contacts },
    ready: answered.profile && answered.checklists,
    actions,
    members,
    me,
  };
}

export function readError(e: unknown, prefix: string): string {
  const code = (e as { code?: string })?.code;
  if (code === 'permission-denied') return `${prefix}: this household doesn't allow it yet.`;
  if (code === 'unavailable') return `${prefix}: offline. It will retry when the connection is back.`;
  return `${prefix}.`;
}
