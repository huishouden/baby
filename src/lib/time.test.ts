import { describe, expect, test } from 'bun:test';
import fixture from './__fixtures__/countdowns.json';
import { babyAge, countdown } from './time';

// The shared time helpers are tested in @huishouden/pwa-kit; these are Baby's own phrases.
const now = new Date(fixture.now).getTime();

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
