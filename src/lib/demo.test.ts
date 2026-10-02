import { expect, test } from 'bun:test';
import { DEMO_NOW, demoData } from './demo';
import { countdown } from './time';
import { latest, sleepState } from './summary';
import { formatAgo } from './time';

test('the before demo is twelve weeks out', () => {
  const d = demoData('before');
  expect(d.profile?.birthDate).toBeUndefined();
  expect(countdown(d.profile!.dueDate!, DEMO_NOW)?.headline).toBe('12 weeks');
  expect(new Date(DEMO_NOW).getFullYear()).toBe(2031);
});

test('the after demo has a sleeping baby fed 2h 10m ago', () => {
  const d = demoData('after');
  expect(d.profile?.birthDate).toBeTruthy();
  expect(formatAgo(latest(d.events, 'feed', DEMO_NOW)!.at, DEMO_NOW)).toBe('2h 10m ago');
  expect(sleepState(d.events, DEMO_NOW).state).toBe('asleep');
  expect(new Set(d.events.map((e) => e.id)).size).toBe(d.events.length);
  for (const e of [...d.events, ...d.appointments, ...d.checklists]) expect(e.by).toMatch(/@example\.com$/);
});
