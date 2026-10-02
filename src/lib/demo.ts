import type { Appointment, BabyEvent, BabyProfile, ChecklistItem } from './model';
import { defaultChecklistDocs } from './checklist';
import { toYmd } from './time';

// Invented sample data for the signed-out app: README screenshots and first impressions. Everything
// is relative to one fixed day in 2031 so nothing resembles a real family's dates.

/** Wednesday 14 May 2031, 10:30 local time. The demo's clock starts here. */
export const DEMO_NOW = new Date(2031, 4, 14, 10, 30).getTime();

export const DEMO_MEMBERS = ['sam@example.com', 'alex@example.com'];
const [SAM, ALEX] = DEMO_MEMBERS;

export type DemoScenario = 'before' | 'after';

export interface BabyData {
  profile: BabyProfile | null;
  events: BabyEvent[];
  checklists: ChecklistItem[];
  appointments: Appointment[];
}

/** Local time on the day `dayOffset` days from the demo day. */
function at(dayOffset: number, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(DEMO_NOW);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

type Row = [string, Partial<BabyEvent> & Pick<BabyEvent, 'kind'>, string?];

function day(offset: number, rows: Row[], startId: number): BabyEvent[] {
  return rows.map(([time, e, by], i) => ({
    id: `demo-${startId + i}`,
    at: at(offset, time),
    by: by ?? (i % 3 === 0 ? ALEX : SAM),
    createdAt: at(offset, time),
    ...e,
  }));
}

const sleepUntil = (offset: number, hhmm: string) => at(offset, hhmm);

function afterEvents(): BabyEvent[] {
  const yesterday: Row[] = [
    ['00:20', { kind: 'feed', method: 'breast', side: 'left' }],
    ['00:45', { kind: 'sleep', endAt: sleepUntil(-1, '03:00') }],
    ['03:05', { kind: 'diaper', diaper: 'wet' }],
    ['03:15', { kind: 'feed', method: 'breast', side: 'right' }],
    ['03:45', { kind: 'sleep', endAt: sleepUntil(-1, '06:10') }],
    ['06:20', { kind: 'feed', method: 'bottle', amountMl: 90 }, ALEX],
    ['06:30', { kind: 'diaper', diaper: 'dirty' }],
    ['07:00', { kind: 'sleep', endAt: sleepUntil(-1, '08:40') }],
    ['09:00', { kind: 'feed', method: 'breast', side: 'both' }],
    ['09:20', { kind: 'pump', amountMl: 110 }, SAM],
    ['10:00', { kind: 'sleep', endAt: sleepUntil(-1, '11:45') }],
    ['11:50', { kind: 'diaper', diaper: 'wet' }],
    ['12:05', { kind: 'feed', method: 'breast', side: 'left' }],
    ['13:00', { kind: 'sleep', endAt: sleepUntil(-1, '14:20') }],
    ['14:40', { kind: 'diaper', diaper: 'both' }],
    ['15:00', { kind: 'feed', method: 'bottle', amountMl: 100 }, ALEX],
    ['15:40', { kind: 'sleep', endAt: sleepUntil(-1, '17:30') }],
    ['17:45', { kind: 'feed', method: 'breast', side: 'right' }],
    ['18:10', { kind: 'diaper', diaper: 'wet' }],
    ['19:30', { kind: 'sleep', endAt: sleepUntil(-1, '20:15') }],
    ['20:40', { kind: 'feed', method: 'breast', side: 'left' }],
    ['21:00', { kind: 'pump', amountMl: 130 }, SAM],
    ['21:20', { kind: 'diaper', diaper: 'wet' }],
    ['21:40', { kind: 'sleep', endAt: sleepUntil(-1, '23:50') }],
  ];
  const today: Row[] = [
    ['00:05', { kind: 'feed', method: 'breast', side: 'right' }, SAM],
    ['00:30', { kind: 'diaper', diaper: 'wet' }, ALEX],
    ['00:40', { kind: 'sleep', endAt: sleepUntil(0, '03:05') }, ALEX],
    ['03:10', { kind: 'diaper', diaper: 'both' }, ALEX],
    ['03:20', { kind: 'feed', method: 'breast', side: 'both' }, SAM],
    ['03:50', { kind: 'sleep', endAt: sleepUntil(0, '05:30') }, SAM],
    ['05:45', { kind: 'feed', method: 'bottle', amountMl: 90, note: 'Took it slowly, burped twice' }, ALEX],
    ['05:55', { kind: 'diaper', diaper: 'wet' }, ALEX],
    ['06:10', { kind: 'pump', amountMl: 120 }, SAM],
    ['06:15', { kind: 'sleep', endAt: sleepUntil(0, '07:50') }, ALEX],
    ['08:00', { kind: 'diaper', diaper: 'dirty' }, SAM],
    ['08:20', { kind: 'feed', method: 'breast', side: 'left' }, SAM],
    ['08:50', { kind: 'sleep', endAt: sleepUntil(0, '09:25') }, ALEX],
    ['09:40', { kind: 'diaper', diaper: 'wet' }, ALEX],
    ['09:55', { kind: 'sleep', endAt: null }, SAM],
  ];
  return [...day(-1, yesterday, 100), ...day(0, today, 200)];
}

function appointments(after: boolean): Appointment[] {
  const list: [number, string, string, string, string?][] = after
    ? [
        [2, '11:00', 'Two-week weight check', 'Riverside Family Clinic'],
        [9, '09:30', 'Postpartum check-up', 'Riverside Family Clinic', 'Bring the feeding log'],
        [27, '10:15', 'One-month check and vaccines', 'Riverside Family Clinic'],
        [-12, '14:00', 'Newborn hearing test', 'City Hospital, level 2'],
      ]
    : [
        [2, '09:30', 'Midwife check-up', 'Riverside Family Clinic, room 4', 'Ask about the birth plan and the hospital tour'],
        [9, '08:00', 'Glucose test', 'Riverside lab', 'Fast from midnight'],
        [16, '18:30', 'Hospital tour', 'City Hospital, main entrance'],
        [23, '19:00', 'Birth class, part 2', 'Community centre, room B'],
        [-14, '19:00', 'Birth class, part 1', 'Community centre, room B'],
        [-42, '10:00', '20-week scan', 'City Hospital, imaging'],
      ];
  return list.map(([d, time, title, location, notes], i) => ({
    id: `demo-appt-${i + 1}`,
    title,
    at: at(d, time),
    location,
    ...(notes ? { notes } : {}),
    createdAt: at(-60, '12:00'),
    by: i % 2 ? ALEX : SAM,
  }));
}

function checklists(after: boolean): ChecklistItem[] {
  const doneBefore = new Set(['default-1-1', 'default-1-2', 'default-1-4', 'default-2-1', 'default-2-2', 'default-3-1', 'default-3-2', 'default-3-3', 'default-4-1', 'default-4-2']);
  return defaultChecklistDocs(at(-60, '12:00'), SAM).map(({ id, data }) => ({
    id,
    ...data,
    done: after ? !id.startsWith('default-4-5') && !id.startsWith('default-4-6') : doneBefore.has(id),
  }));
}

export function demoData(scenario: DemoScenario): BabyData {
  const after = scenario === 'after';
  const profile: BabyProfile = after
    ? { name: 'Robin', dueDate: toYmd(at(-15, '12:00')), birthDate: toYmd(at(-18, '12:00')), updatedAt: at(-18, '12:00'), updatedBy: SAM }
    : { dueDate: toYmd(at(12 * 7 + 3, '12:00')), updatedAt: at(-30, '12:00'), updatedBy: SAM };
  return {
    profile,
    events: after ? afterEvents() : [],
    checklists: checklists(after),
    appointments: appointments(after),
  };
}
