import { plainText, type CalendarMatch } from '@huishouden/pwa-kit/calendar';
import { LIMITS } from './model';

/** What Import from calendar looks for: the words baby-related events tend to carry. */
export const BABY_CALENDAR_QUERIES = [
  'prenatal',
  'ob',
  'obgyn',
  'midwife',
  'ultrasound',
  'pediatric',
  'pediatrician',
  'baby',
  'doula',
  'lactation',
  'hospital tour',
  'glucose',
];

/** The appointment fields a calendar event fills in. */
export function fromCalendar(m: CalendarMatch): { title: string; at: number; location?: string; notes?: string; calendarEventId: string; calendarLink: string } {
  const notes = plainText(m.description ?? '', LIMITS.notes);
  const location = m.location?.trim().slice(0, LIMITS.location);
  return {
    title: m.title.trim().slice(0, LIMITS.title),
    at: m.start,
    ...(location ? { location } : {}),
    ...(notes ? { notes } : {}),
    calendarEventId: m.id,
    calendarLink: m.link,
  };
}
