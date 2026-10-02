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
  for (const e of [...d.events, ...d.appointments, ...d.checklists, ...d.contacts]) expect(e.by).toMatch(/@example\.com$/);
});

test('sample contacts are invented and every appointment contact exists', () => {
  for (const scenario of ['before', 'after'] as const) {
    const d = demoData(scenario);
    expect(d.contacts.length).toBeGreaterThanOrEqual(2);
    for (const c of d.contacts) {
      expect(c.apps).toContain('baby');
      if (c.phone) expect(c.phone).toMatch(/555\) 010-01\d\d/);
      if (c.website) expect(new URL(c.website).hostname).toMatch(/example\.com$/);
      if (c.email) expect(c.email).toMatch(/example\.com$/);
    }
    const ids = new Set(d.contacts.map((c) => c.id));
    for (const a of d.appointments) if (a.contactId) expect(ids.has(a.contactId)).toBe(true);
  }
});
