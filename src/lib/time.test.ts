import { describe, expect, test } from 'bun:test';
import fixture from './__fixtures__/countdowns.json';
import { DAY, HOUR, MINUTE, addDays, babyAge, relativeDay, countdown, formatAgo, formatDuration, formatHours, fromLocalInput, parseYmd, toLocalInput, toYmd } from './time';

const now = new Date(fixture.now).getTime();

describe('durations', () => {
  test.each([
    [0, '0m'],
    [59_000, '0m'],
    [35 * MINUTE, '35m'],
    [HOUR, '1h'],
    [2 * HOUR + 10 * MINUTE + 59_000, '2h 10m'],
    [DAY + 3 * HOUR + 5 * MINUTE, '1d 3h'],
    [2 * DAY, '2d'],
    [-5 * MINUTE, '0m'],
  ])('%p ms is %p', (ms, text) => expect(formatDuration(ms)).toBe(text));

  test('ago', () => {
    expect(formatAgo(now - 30_000, now)).toBe('just now');
    expect(formatAgo(now - 70 * MINUTE, now)).toBe('1h 10m ago');
  });

  test('hours', () => {
    expect(formatHours(9 * HOUR + 30 * MINUTE)).toBe('9.5 h');
    expect(formatHours(14 * HOUR)).toBe('14 h');
    expect(formatHours(5 * HOUR + 35 * MINUTE)).toBe('5.6 h');
  });
});

describe('countdown', () => {
  for (const c of fixture.cases) {
    test(`due ${c.dueDate}`, () => {
      const r = countdown(c.dueDate, now);
      if (c.headline === null) return expect(r).toBeNull();
      expect(r).toEqual({ days: c.days!, headline: c.headline, suffix: c.suffix!, week: c.week! });
    });
  }
});

describe('age', () => {
  for (const a of fixture.ages) test(`born ${a.birthDate}`, () => expect(babyAge(a.birthDate, now)).toBe(a.age));
});

describe('dates', () => {
  test('YYYY-MM-DD round trip in local time', () => {
    expect(toYmd(parseYmd('2031-03-05')!)).toBe('2031-03-05');
    expect(parseYmd('2031-3-5')).toBeNull();
    expect(parseYmd(undefined)).toBeNull();
  });

  test('addDays lands on local midnight', () => {
    expect(toYmd(addDays(now, 1))).toBe('2031-03-06');
    expect(new Date(addDays(now, -1)).getHours()).toBe(0);
  });

  test('datetime-local inputs', () => {
    expect(toLocalInput(now)).toBe('2031-03-05T12:00');
    expect(fromLocalInput('2031-03-05T12:00')).toBe(now);
    expect(fromLocalInput('')).toBeNull();
  });
});

describe('relative days', () => {
  test.each([
    [0, 'Today'],
    [1, 'Tomorrow'],
    [-1, 'Yesterday'],
    [5, 'In 5 days'],
    [-12, '12 days ago'],
  ])('%p days', (d, text) => expect(relativeDay(addDays(now, d) + 9 * HOUR, now)).toBe(text));
});
