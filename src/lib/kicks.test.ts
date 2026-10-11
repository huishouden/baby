import { describe, expect, test } from 'bun:test';
import type { KickSession } from './model';
import { CALL_AFTER, atLocal, needsCall, newestFirst, reachedTarget, running, sessionId, strip, targetOf, timeToTarget, withTap, withoutLastTap } from './kicks';

const MIN = 60_000;
const NOW = new Date(2031, 4, 14, 20, 0).getTime();
const at = (dayOffset: number, h: number, m = 0) => new Date(2031, 4, 14 + dayOffset, h, m).getTime();
let n = 0;
/** A session started at `start` with a movement every `gap` minutes, `count` of them. */
const session = (start: number, count: number, gap = 2, extra: Partial<KickSession> = {}): KickSession => ({
  id: `k${n++}`,
  start,
  taps: Array.from({ length: count }, (_, i) => start + (i + 1) * gap * MIN),
  target: 10,
  by: 'a@example.com',
  createdAt: start,
  ...extra,
});

describe('a session', () => {
  test('ends at the target movement and reports the time to it', () => {
    let s = session(NOW, 0);
    for (let i = 1; i <= 10; i++) s = withTap(s, NOW + i * 2 * MIN)!;
    expect(s.end).toBe(NOW + 20 * MIN);
    expect(reachedTarget(s)).toBe(true);
    expect(timeToTarget(s)).toBe(20 * MIN);
    expect(withTap(s, NOW + 25 * MIN)).toBeNull();
  });

  test('a stopped session under the target has no time to target', () => {
    const s = session(NOW, 6, 2, { end: NOW + 15 * MIN });
    expect(timeToTarget(s)).toBeNull();
    expect(running([s])).toBeUndefined();
  });

  test('undo takes back the last movement and reopens a session the target had ended', () => {
    const done = session(NOW, 10, 2, { end: NOW + 20 * MIN });
    const back = withoutLastTap(done, NOW + 21 * MIN)!;
    expect(back.taps).toHaveLength(9);
    expect('end' in back).toBe(false);
    const stopped = session(NOW, 5, 2, { end: NOW + 30 * MIN });
    expect(withoutLastTap(stopped, NOW + 31 * MIN)!.end).toBe(NOW + 30 * MIN);
    expect(withoutLastTap(session(NOW, 0), NOW)).toBeNull();
  });

  test('a configurable target ends it earlier or later', () => {
    const s = withTap(session(NOW, 4, 2, { target: 5 }), NOW + 10 * MIN)!;
    expect(s.end).toBe(NOW + 10 * MIN);
    expect(targetOf({ target: 8 })).toBe(8);
    expect(targetOf(null)).toBe(10);
    expect(targetOf({ target: 400 })).toBe(50);
  });
});

describe('needsCall', () => {
  test('only a running session still under its target after two hours', () => {
    const start = NOW - CALL_AFTER;
    expect(needsCall(session(start, 7), NOW)).toBe(true);
    expect(needsCall(session(start + MIN, 7), NOW)).toBe(false);
    expect(needsCall(session(start, 10, 2, { end: start + 20 * MIN }), NOW)).toBe(false);
    expect(needsCall(session(start, 7, 2, { end: start + 30 * MIN }), NOW)).toBe(false);
  });
});

describe('ids and the strip', () => {
  test('a day’s first session is the day; later ones are numbered', () => {
    expect(sessionId(NOW, [])).toBe('2031-05-14');
    expect(sessionId(NOW, ['2031-05-14'])).toBe('2031-05-14-2');
    expect(sessionId(NOW, ['2031-05-14', '2031-05-14-2'])).toBe('2031-05-14-3');
    expect(sessionId(NOW, ['2031-05-13'])).toBe('2031-05-14');
  });

  test('fourteen days ending today, each with the day’s first session in minutes', () => {
    const list = [session(at(0, 9), 10, 2), session(at(0, 15), 10, 5), session(at(-2, 9), 10, 3), session(at(-3, 9), 4, 2, { end: at(-3, 10) }), session(at(-20, 9), 10)];
    const days = strip(list, NOW);
    expect(days).toHaveLength(14);
    expect(days[13]).toMatchObject({ ymd: '2031-05-14', minutes: 20 });
    expect(days[11]).toMatchObject({ ymd: '2031-05-12', minutes: 30 });
    expect(days[10].minutes).toBeNull();
    expect(days[10].session).toBeDefined();
    expect(days[12].session).toBeUndefined();
    expect(days[0].ymd).toBe('2031-05-01');
  });

  test('newest first', () => {
    const a = session(at(-1, 9), 1);
    const b = session(at(0, 9), 1);
    expect(newestFirst([a, b])).toEqual([b, a]);
  });
});

describe('atLocal', () => {
  test('a local time on a day; malformed ones are null', () => {
    expect(atLocal('2031-05-14', '19:30')).toBe(at(0, 19, 30));
    expect(atLocal('2031-05-14', '24:00')).toBeNull();
    expect(atLocal('nope', '19:30')).toBeNull();
  });
});
