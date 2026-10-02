import { describe, expect, test } from 'bun:test';
import type { CalendarMatch } from '@huishouden/pwa-kit/calendar';
import fixture from './__fixtures__/calendar-matches.json';
import { calendarError, fromCalendar, isImported, notImported, plainText } from './calendarImport';
import type { Appointment } from './model';
import { LIMITS } from './model';

const matches = fixture.matches as CalendarMatch[];
const [prenatal, tour, scan] = matches;
const appt = (fields: Partial<Appointment>): Appointment => ({ id: 'a1', title: 'Something', at: 1, createdAt: 1, by: 'sam@example.com', ...fields });

describe('notes from a calendar description', () => {
  test('HTML becomes plain text with line breaks', () => {
    expect(plainText(prenatal.description)).toBe('Bring the glucose results.\nAsk about the birth plan & hospital tour.');
  });

  test('plain text passes through and empty stays empty', () => {
    expect(plainText(scan.description)).toBe('Line one\nLine two');
    expect(plainText('   ')).toBe('');
  });

  test('long descriptions are cut to the notes limit', () => {
    const out = plainText('word '.repeat(400));
    expect(out.length).toBeLessThanOrEqual(LIMITS.notes);
    expect(out.endsWith('…')).toBe(true);
  });
});

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
});

describe('import de-duplication', () => {
  test('an event counts as imported by id, by link, or by the same title at the same time', () => {
    expect(isImported(prenatal, [appt({ calendarEventId: 'evt-prenatal-1' })])).toBe(true);
    expect(isImported(prenatal, [appt({ calendarLink: prenatal.link })])).toBe(true);
    expect(isImported(prenatal, [appt({ title: ' prenatal VISIT ', at: prenatal.start })])).toBe(true);
    expect(isImported(prenatal, [appt({ title: 'Prenatal visit', at: prenatal.start + 60_000 })])).toBe(false);
    expect(isImported(prenatal, [])).toBe(false);
  });

  test('lists each new event once, soonest first', () => {
    expect(notImported(matches, []).map((m) => m.id)).toEqual(['evt-scan', 'evt-prenatal-1', 'evt-tour']);
    expect(notImported(matches, [appt({ calendarEventId: 'evt-scan' })]).map((m) => m.id)).toEqual(['evt-prenatal-1', 'evt-tour']);
  });
});

test('a closed Google window reads as not allowed; anything else as a connection problem', () => {
  expect(calendarError({ code: 'auth/popup-closed-by-user' })).toContain('not allowed');
  expect(calendarError({ code: 'auth/popup-blocked' })).toContain('pop-ups');
  expect(calendarError(new Error('[500] Calendar: backend'))).toContain('connection');
});
