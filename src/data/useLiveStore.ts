import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { deleteDoc, setDoc, updateDoc, writeBatch } from '@huishouden/pwa-kit/firestore';
import { addContact, removeContactFromApp, restoreContact, updateContact, watchContacts, type Contact } from '@huishouden/pwa-kit/contacts';
import type { Appointment, BabyEvent, BabyProfile, ChecklistItem } from '../lib/model';
import { APP } from '../lib/contacts';
import { cleanEvent } from '../lib/model';
import { defaultChecklistDocs, nextOrder } from '../lib/checklist';
import { DAY } from '@huishouden/pwa-kit/time';
import { readError } from '@huishouden/pwa-kit/feedback';
import { removeAgenda, replaceAgenda, syncAgenda } from '@huishouden/pwa-kit/agenda';
import { agendaItems, appointmentAgenda, appointmentRef } from '../lib/agenda';
import { db } from './firebase';
import { appointmentDoc, eventFields, newEventDoc, profileDoc } from './build';
import type { BabyActions, BabyStore } from './types';

/** How far back the log reads: enough for the day picker, small enough to stay fast. */
const HISTORY_DAYS = 14;

const withoutId = <T extends { id: string }>({ id: _id, ...rest }: T) => rest;

/** The household agenda is a copy for the portal: a failed write there never interrupts Baby. */
const publish = (p: Promise<unknown>) => void p.catch((e) => console.warn("Couldn't update the household agenda", e));

/**
 * Live household data from Firestore with onSnapshot listeners. Writes are fire-and-forget: the
 * persistent cache applies them locally at once (also offline) and syncs later. They come from the
 * kit, which also notes each one in localStorage until Firestore has it, so a feed logged as the
 * app is closed is not lost. The kit's contact and agenda helpers write the same way.
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
  const profileRef = useRef<BabyProfile | null>(null);
  profileRef.current = profile;
  // Whether the profile and appointments have answered from the server, not just the local cache:
  // the agenda is reconciled against them once per household when both have.
  const [fromServer, setFromServer] = useState({ profile: false, appointments: false });
  const syncedFor = useRef<string | null>(null);
  const errorRef = useRef(onError);
  errorRef.current = onError;

  const base = `households/${householdId}`;

  useEffect(() => {
    const fail = (what: string) => (e: Error) => errorRef.current(readError(e, `Couldn't load ${what}`));
    const since = Date.now() - HISTORY_DAYS * DAY;
    const unsubs = [
      onSnapshot(
        doc(db, base, 'babyProfile', 'main'),
        { includeMetadataChanges: true },
        (s) => {
          setProfile(s.exists() ? (s.data() as BabyProfile) : null);
          setAnswered((a) => ({ ...a, profile: true }));
          if (!s.metadata.fromCache) setFromServer((f) => (f.profile ? f : { ...f, profile: true }));
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
        { includeMetadataChanges: true },
        (s) => {
          setAppointments(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Appointment, 'id'>) })));
          if (!s.metadata.fromCache) setFromServer((f) => (f.appointments ? f : { ...f, appointments: true }));
        },
        fail('the appointments'),
      ),
      watchContacts(db, householdId, setContacts, { app: APP, onError: fail('the contacts') }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [base, householdId, me]);

  useEffect(() => {
    if (!fromServer.profile || !fromServer.appointments || syncedFor.current === householdId) return;
    syncedFor.current = householdId;
    publish(syncAgenda(db, householdId, APP, agendaItems({ profile, appointments }), { by: me }));
  }, [fromServer, householdId, me, profile, appointments]);

  const actions = useMemo<BabyActions>(() => {
    const report = (p: Promise<unknown>) => void p.catch((e) => errorRef.current(readError(e, "Couldn't save")));
    const col = (name: string) => collection(db, base, name);
    const publishAppointment = (a: Appointment) =>
      publish(replaceAgenda(db, householdId, APP, appointmentRef(a.id), appointmentAgenda(a, profileRef.current), { by: me }));
    return {
      saveProfile: (p) => {
        const data = profileDoc(p, me, Date.now());
        report(setDoc(doc(db, base, 'babyProfile', 'main'), data));
        // The due date and the baby's name on every appointment may both have changed.
        publish(syncAgenda(db, householdId, APP, agendaItems({ profile: data, appointments: appointmentsRef.current }), { by: me }));
      },
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
        const data = appointmentDoc(input, existing?.by ?? me, existing?.createdAt ?? Date.now());
        report(setDoc(ref, data));
        publishAppointment({ id: ref.id, ...data });
      },
      deleteAppointment: (id) => {
        report(deleteDoc(doc(col('babyAppointments'), id)));
        publish(removeAgenda(db, householdId, APP, appointmentRef(id)));
      },
      restoreAppointment: (a) => {
        report(setDoc(doc(col('babyAppointments'), a.id), withoutId(a)));
        publishAppointment(a);
      },
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
