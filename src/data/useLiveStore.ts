import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { commitOps, setDoc, writeBatch } from '@huishouden/pwa-kit/firestore';
import { householdContacts, markUnflaggedOpen, watchContacts, type Contact } from '@huishouden/pwa-kit/contacts';
import { can, isRestricted, type Role } from '@huishouden/pwa-kit/roles';
import type { Appointment, BabyEvent, BabyProfile, ChecklistItem } from '../lib/model';
import { APP } from '../lib/contacts';
import { defaultChecklistDocs } from '../lib/checklist';
import { DAY } from '@huishouden/pwa-kit/time';
import { readError } from '@huishouden/pwa-kit/feedback';
import { removeAgenda, replaceAgenda, syncAgenda } from '@huishouden/pwa-kit/agenda';
import { agendaItems, appointmentAgenda, appointmentRef } from '../lib/agenda';
import { db } from './firebase';
import { COLLECTIONS, createActions, type Backend } from './actions';
import type { BabyData, BabyStore } from './types';

/** How far back the log reads: enough for the day picker, small enough to stay fast. */
const HISTORY_DAYS = 14;

/** The household agenda is a copy for the portal: a failed write there never interrupts Baby. */
const publish = (p: Promise<unknown>) => void p.catch((e) => console.warn("Couldn't update the household agenda", e));

/**
 * Live household data from Firestore with onSnapshot listeners. Writes are fire-and-forget: the
 * persistent cache applies them locally at once (also offline) and syncs later. They come from the
 * kit, which also notes each one in localStorage until Firestore has it, so a feed logged as the
 * app is closed is not lost. The kit's contact and agenda helpers write the same way.
 */
export function useLiveStore(householdId: string, me: string, members: string[], role: Role | null, onError: (message: string) => void): BabyStore {
  // Helpers and kids read only appointments and contacts not marked private, and must ask for just those.
  const restricted = isRestricted(role);
  const [profile, setProfile] = useState<BabyProfile | null>(null);
  const [events, setEvents] = useState<BabyEvent[]>([]);
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [answered, setAnswered] = useState({ profile: false, checklists: false });
  const data: BabyData = { profile, events, checklists, appointments, contacts };
  // The data as of the last render, for actions (an edit keeps its author; a new item goes last).
  const current = useRef(data);
  current.current = data;
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
        restricted ? query(collection(db, base, 'babyAppointments'), where('private', '==', false)) : collection(db, base, 'babyAppointments'),
        { includeMetadataChanges: true },
        (s) => {
          setAppointments(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Appointment, 'id'>) })));
          if (!s.metadata.fromCache) setFromServer((f) => (f.appointments ? f : { ...f, appointments: true }));
        },
        fail('the appointments'),
      ),
      watchContacts(db, householdId, setContacts, { app: APP, restricted, onError: fail('the contacts') }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [base, householdId, me, restricted]);

  // Appointments saved before the private flag are hidden from helpers and kids until written with
  // `private: false`: an admin's or member's device does that once they have loaded.
  const seesPrivate = can(role, 'see-private');
  useEffect(() => {
    if (!seesPrivate || !fromServer.appointments || !appointments.some((a) => typeof a.private !== 'boolean')) return;
    markUnflaggedOpen(db, householdId, 'babyAppointments', appointments).catch(() => {});
  }, [seesPrivate, fromServer.appointments, appointments, householdId]);

  useEffect(() => {
    if (!fromServer.profile || !fromServer.appointments || syncedFor.current === householdId) return;
    syncedFor.current = householdId;
    publish(syncAgenda(db, householdId, APP, agendaItems({ profile, appointments }), { by: me, restricted }));
  }, [fromServer, householdId, me, profile, appointments, restricted]);

  const actions = useMemo(() => {
    const report = (p: Promise<unknown>) => void p.catch((e) => errorRef.current(readError(e, "Couldn't save")));
    const publishAppointment = (a: Appointment) =>
      publish(replaceAgenda(db, householdId, APP, appointmentRef(a.id), appointmentAgenda(a, current.current.profile), { by: me, restricted }));
    const backend: Backend = {
      newId: (col) => doc(collection(db, base, COLLECTIONS[col])).id,
      write: (ops) => {
        report(commitOps(db, base, ops, (col) => COLLECTIONS[col]));
        // The household agenda follows each appointment saved, restored or deleted.
        for (const op of ops) {
          if (op.col !== 'appointments') continue;
          if (op.data) publishAppointment({ id: op.id, ...(op.data as Omit<Appointment, 'id'>) });
          else publish(removeAgenda(db, householdId, APP, appointmentRef(op.id), { restricted }));
        }
      },
      saveProfile: (profile) => {
        report(setDoc(doc(db, base, 'babyProfile', 'main'), profile));
        // The due date and the baby's name on every appointment may both have changed.
        publish(syncAgenda(db, householdId, APP, agendaItems({ profile, appointments: current.current.appointments }), { by: me, restricted }));
      },
      contacts: householdContacts(db, householdId, APP, me, report),
    };
    return createActions(backend, () => current.current, me, () => Date.now());
  }, [base, householdId, me, restricted]);

  return {
    data,
    ready: answered.profile && answered.checklists,
    actions,
    members,
    me,
    role,
  };
}
