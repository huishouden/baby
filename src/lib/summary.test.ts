import { describe, expect, test } from 'bun:test';
import fixture from './__fixtures__/night-and-morning.json';
import type { BabyEvent } from './model';
import { dayTimeline, dayTotals, describeEvent, diaperBreakdown, feedDetail, latest, sleepSessions, sleepState } from './summary';
import { MINUTE, formatAgo, formatDuration, startOfDay } from './time';

// Fixture times are local ("2031-03-05T10:30" without an offset), so results hold in any time zone.
const t = (s: string) => new Date(s).getTime();
const now = t(fixture.now);
const events: BabyEvent[] = fixture.events.map((e) => ({
  ...(e as unknown as BabyEvent),
  at: t(e.at),
  ...('endAt' in e ? { endAt: e.endAt === null ? null : t(e.endAt as string) } : {}),
  createdAt: t(e.at),
}));
const exp = fixture.expected;

describe('glance', () => {
  test('last feed ignores entries after now', () => {
    const feed = latest(events, 'feed', now)!;
    expect(feed.id).toBe(exp.lastFeedId);
    expect(formatAgo(feed.at, now)).toBe(exp.lastFeedAgo);
    expect(feedDetail(feed)).toBe(exp.lastFeedDetail);
  });

  test('a sleep with no end means asleep', () => {
    const s = sleepState(events, now);
    expect(s.state).toBe('asleep');
    if (s.state === 'asleep') expect(formatDuration(now - s.since)).toBe(exp.sleep.for);
  });

  test('awake since the last sleep ended', () => {
    const ended = events.map((e) => (e.id === 'e11' ? { ...e, endAt: t('2031-03-05T10:10') } : e));
    expect(sleepState(ended, now)).toEqual({ state: 'awake', since: t('2031-03-05T10:10') });
    expect(sleepState([], now)).toEqual({ state: 'unknown' });
  });

  test('last diaper', () => {
    expect(latest(events, 'diaper', now)!.id).toBe(exp.lastDiaperId);
  });
});

describe('day totals', () => {
  const totals = dayTotals(events, startOfDay(now), now);

  test('counts feeds, diapers and pumping inside the day up to now', () => {
    const { sleepMs, ...rest } = totals;
    const { sleepMinutes, ...expected } = exp.totals;
    expect(rest).toEqual(expected);
    expect(sleepMs / MINUTE).toBe(sleepMinutes);
  });

  test('sleep is clipped to midnight and a running sleep counts up to now', () => {
    const sessions = sleepSessions(events, startOfDay(now), now, now);
    expect(sessions.map((s) => s.event.id)).toEqual(['e11', 'e4', 'e1']);
    expect(sessions[0].running).toBe(true);
  });

  test('the previous day counts only its own part of an overnight sleep', () => {
    const yesterday = startOfDay(now) - 12 * 60 * MINUTE;
    expect(dayTotals(events, startOfDay(yesterday), now).sleepMs / MINUTE).toBe(120);
  });

  test('diaper breakdown wording', () => {
    expect(diaperBreakdown(totals.diapers)).toBe(exp.diaperBreakdown);
    expect(diaperBreakdown({ wet: 0, dirty: 0, both: 0 })).toBe('none yet');
  });
});

describe('timeline', () => {
  test('newest first, including sleep that started the night before', () => {
    expect(dayTimeline(events, startOfDay(now), now).map((e) => e.id)).toEqual(exp.timelineIds);
  });

  test('descriptions', () => {
    const byId = Object.fromEntries(events.map((e) => [e.id, e]));
    expect(describeEvent(byId.e9, now)).toBe('Feed, left');
    expect(describeEvent(byId.e5, now)).toBe('Bottle, 90 ml');
    expect(describeEvent(byId.e4, now)).toBe('Sleep, 3h 30m');
    expect(describeEvent(byId.e11, now)).toBe('Sleeping, 35m');
    expect(describeEvent(byId.e6, now)).toBe('Diaper, both');
    expect(describeEvent(byId.e7, now)).toBe('Pump, 120 ml');
  });
});
