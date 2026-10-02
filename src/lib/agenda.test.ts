import { describe, expect, test } from 'bun:test';
import { agendaDoc, allDayStart, inAgendaWindow } from '@huishouden/pwa-kit/agenda';
import fixture from './__fixtures__/agenda-household.json';
import { APP_URL, DUE_DATE_REF, agendaItems, appointmentAgenda, appointmentRef, dueDateAgenda } from './agenda';
import { DEMO_NOW } from './demo';
import type { Appointment, BabyProfile } from './model';

const profile = fixture.profile as BabyProfile;
const appointments = fixture.appointments as Appointment[];
const [visit, tour] = appointments;

describe('an appointment on the agenda', () => {
  test('is one timed item at its place, for the baby, linking to the Appointments tab', () => {
    expect(appointmentAgenda(visit, profile)).toEqual([
      {
        kind: 'appointment',
        title: 'Prenatal visit',
        start: visit.at,
        allDay: false,
        detail: 'Riverside Family Clinic, 40 River Road, Springfield',
        url: 'https://huishouden-baby.web.app/#appointments',
        who: 'Robin',
      },
    ]);
  });

  test('has no status, no detail without a place and no who without a name', () => {
    const [item] = appointmentAgenda(tour, { ...profile, name: '  ' });
    expect(item).toEqual({ kind: 'appointment', title: 'Hospital tour', start: tour.at, allDay: false, url: `${APP_URL}/#appointments` });
  });

  test('notes stay in the app', () => {
    expect(JSON.stringify(appointmentAgenda(visit, profile))).not.toContain('glucose');
  });

  test('a blank title publishes nothing', () => {
    expect(appointmentAgenda({ ...visit, title: ' ' }, profile)).toEqual([]);
  });
});

describe('the due date on the agenda', () => {
  test('is an all-day item from local midnight, linking to the app', () => {
    expect(dueDateAgenda(profile)).toEqual([
      { kind: 'other', title: 'Due date', start: allDayStart('2031-08-06'), allDay: true, url: `${APP_URL}/`, who: 'Robin' },
    ]);
    expect(new Date(dueDateAgenda(profile)[0].start).getHours()).toBe(0);
  });

  test('goes once the baby is born, and is absent without a valid date', () => {
    expect(dueDateAgenda({ ...profile, birthDate: '2031-08-01' })).toEqual([]);
    expect(dueDateAgenda({ ...profile, dueDate: undefined })).toEqual([]);
    expect(dueDateAgenda({ ...profile, dueDate: 'soon' })).toEqual([]);
    expect(dueDateAgenda(null)).toEqual([]);
  });
});

describe('everything Baby publishes', () => {
  const items = agendaItems({ profile, appointments });

  test('the due date and each appointment, under their own refs', () => {
    expect(items.map((i) => [i.ref, i.kind])).toEqual([
      [DUE_DATE_REF, 'other'],
      [appointmentRef('appt-1'), 'appointment'],
      [appointmentRef('appt-2'), 'appointment'],
    ]);
  });

  test('every item is a document the rules accept', () => {
    for (const item of items) expect(() => agendaDoc('baby', item, 'Sam@Example.com', DEMO_NOW)).not.toThrow();
  });

  test('all three fall inside the published window in the demo week', () => {
    expect(items.every((i) => inAgendaWindow(i, DEMO_NOW))).toBe(true);
  });

  test('another address gives links into it', () => {
    expect(agendaItems({ profile, appointments: [tour] }, 'https://baby.example.com').map((i) => i.url)).toEqual([
      'https://baby.example.com/',
      'https://baby.example.com/#appointments',
    ]);
  });

  test('a household with nothing dated publishes nothing', () => {
    expect(agendaItems({ profile: null, appointments: [] })).toEqual([]);
  });
});
