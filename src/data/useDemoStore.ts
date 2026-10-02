import { useMemo, useState } from 'react';
import type { Appointment, BabyEvent, ChecklistItem } from '../lib/model';
import { cleanEvent } from '../lib/model';
import { DEMO_MEMBERS, demoData, type BabyData, type DemoScenario } from '../lib/demo';
import { nextOrder } from '../lib/checklist';
import { appointmentDoc, eventFields, newEventDoc, profileDoc } from './build';
import type { BabyActions, BabyStore } from './types';

/**
 * Sample data kept in memory: the signed-out app is fully clickable, nothing is saved, and a reload
 * starts over. `clock` is the demo's moving "now" (fixed 2031 start plus time since load).
 */
export function useDemoStore(scenario: DemoScenario, clock: () => number): BabyStore {
  const [data, setData] = useState<BabyData>(() => demoData(scenario));
  const me = DEMO_MEMBERS[0];

  const actions = useMemo<BabyActions>(() => {
    let seq = 0;
    const id = () => `local-${Date.now()}-${seq++}`;
    const patch = (f: (d: BabyData) => BabyData) => setData((d) => f(d));
    const upsert = <T extends { id: string }>(list: T[], item: T) => [...list.filter((x) => x.id !== item.id), item];
    return {
      saveProfile: (p) => patch((d) => ({ ...d, profile: profileDoc(p, me, clock()) })),
      logEvent: (f) => {
        const now = clock();
        const event: BabyEvent = { id: id(), ...newEventDoc({ ...f, at: f.at ?? now }, me, now) };
        patch((d) => ({ ...d, events: [...d.events, event] }));
        return event;
      },
      updateEvent: (event, f) =>
        patch((d) => ({
          ...d,
          events: upsert(d.events, { id: event.id, ...cleanEvent({ ...eventFields(f), by: event.by, createdAt: event.createdAt, updatedAt: clock() }) }),
        })),
      deleteEvent: (eid) => patch((d) => ({ ...d, events: d.events.filter((e) => e.id !== eid) })),
      restoreEvent: (e) => patch((d) => ({ ...d, events: upsert(d.events, e) })),
      addChecklistItem: (list, text) => {
        const t = text.trim().slice(0, 200);
        if (!t || !list.trim()) return;
        patch((d) => ({
          ...d,
          checklists: [...d.checklists, { id: id(), list: list.trim(), text: t, done: false, order: nextOrder(d.checklists, list.trim()), createdAt: clock(), by: me }],
        }));
      },
      setChecklistDone: (cid, done) => patch((d) => ({ ...d, checklists: d.checklists.map((c) => (c.id === cid ? { ...c, done } : c)) })),
      deleteChecklistItem: (cid) => patch((d) => ({ ...d, checklists: d.checklists.filter((c) => c.id !== cid) })),
      restoreChecklistItem: (item: ChecklistItem) => patch((d) => ({ ...d, checklists: upsert(d.checklists, item) })),
      reorderChecklist: (writes) =>
        patch((d) => ({
          ...d,
          checklists: d.checklists.map((c) => {
            const w = writes.find((x) => x.id === c.id);
            return w ? { ...c, order: w.order } : c;
          }),
        })),
      saveAppointment: (aid, input) =>
        patch((d) => {
          const existing = aid ? d.appointments.find((a) => a.id === aid) : undefined;
          const a: Appointment = { id: aid ?? id(), ...appointmentDoc(input, existing?.by ?? me, existing?.createdAt ?? clock()) };
          return { ...d, appointments: upsert(d.appointments, a) };
        }),
      deleteAppointment: (aid) => patch((d) => ({ ...d, appointments: d.appointments.filter((a) => a.id !== aid) })),
      restoreAppointment: (a) => patch((d) => ({ ...d, appointments: upsert(d.appointments, a) })),
    };
  }, [clock, me]);

  return { data, ready: true, actions, members: DEMO_MEMBERS, me };
}
