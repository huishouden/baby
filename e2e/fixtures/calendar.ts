import type { CalendarMatch } from '@huishouden/pwa-kit/calendar';

// Invented events around the sample family's 2031 dates, standing in for Google Calendar.
const at = (month: number, day: number, h: number, m = 0) => new Date(2031, month - 1, day, h, m).getTime();

export const calendarEvents: CalendarMatch[] = [
  {
    id: 'evt-prenatal',
    title: 'Prenatal visit',
    start: at(6, 3, 9, 30),
    end: at(6, 3, 10, 0),
    allDay: false,
    location: '40 River Road, Springfield',
    description: '<p>Bring the glucose results.</p>',
    link: 'https://calendar.example.com/event?eid=evt-prenatal',
    calendarName: 'Family',
  },
  {
    id: 'evt-lactation',
    title: 'Lactation class',
    start: at(6, 10, 18, 0),
    allDay: false,
    location: 'Community centre, room B',
    description: '',
    link: 'https://calendar.example.com/event?eid=evt-lactation',
    calendarName: 'Sam',
  },
  {
    id: 'evt-peds',
    title: 'Pediatrician meet and greet',
    start: at(6, 17, 16, 15),
    allDay: false,
    location: '',
    description: '',
    link: 'https://calendar.example.com/event?eid=evt-peds',
    calendarName: 'Family',
  },
  // Already in the sample appointments (same title and time), so the import leaves it out.
  {
    id: 'evt-glucose',
    title: 'Glucose test',
    start: at(5, 23, 8, 0),
    allDay: false,
    location: 'Riverside lab',
    description: '',
    link: 'https://calendar.example.com/event?eid=evt-glucose',
    calendarName: 'Family',
  },
];

/** Run before the page loads: the app then treats the browser as able to read a calendar. */
export function mockCalendar(events: CalendarMatch[]) {
  (window as unknown as { __mockCalendarEvents: CalendarMatch[] }).__mockCalendarEvents = events;
}
