import { describe, expect, test } from 'bun:test';
import type { CalendarMatch } from '@huishouden/pwa-kit/calendar';
import fixture from './__fixtures__/calendar-matches.json';
import { fromCalendar } from './calendarImport';
import { LIMITS } from './model';

const matches = fixture.matches as CalendarMatch[];
const [prenatal, tour] = matches;

describe('an appointment from a calendar event', () => {
  test('fills title, time, place, notes and the event link', () => {
    expect(fromCalendar(prenatal)).toEqual({
      title: 'Prenatal visit',
      at: prenatal.start,
      location: 'Riverside Family Clinic, 40 River Road, Springfield',
      notes: 'Bring the glucose results.\nAsk about the birth plan & hospital tour.',
      calendarEventId: 'evt-prenatal-1',
      calendarLink: 'https://www.google.com/calendar/event?eid=evt-prenatal-1',
    });
  });

  test('leaves out an empty place and notes', () => {
    const out = fromCalendar(tour);
    expect('location' in out).toBe(false);
    expect('notes' in out).toBe(false);
  });

  test('long descriptions are cut to the notes limit', () => {
    const out = fromCalendar({ ...prenatal, description: 'word '.repeat(400) });
    expect(out.notes!.length).toBeLessThanOrEqual(LIMITS.notes);
    expect(out.notes!.endsWith('…')).toBe(true);
  });
});
