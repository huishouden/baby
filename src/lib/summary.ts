import type { BabyEvent, DiaperKind } from './model';
import { addDays, formatDuration } from './time';

// What the log screen shows at a glance, derived from the event list. Pure: `now` is passed in.

const newestFirst = (a: BabyEvent, b: BabyEvent) => b.at - a.at;

export function latest(events: BabyEvent[], kind: BabyEvent['kind'], now: number): BabyEvent | null {
  let best: BabyEvent | null = null;
  for (const e of events) if (e.kind === kind && e.at <= now && (!best || e.at > best.at)) best = e;
  return best;
}

/** "left", "bottle, 90 ml", "both". */
export function feedDetail(e: BabyEvent): string {
  if (e.method === 'bottle') return e.amountMl ? `bottle, ${e.amountMl} ml` : 'bottle';
  return e.side ?? 'breast';
}

export type SleepState =
  | { state: 'asleep'; since: number; event: BabyEvent }
  | { state: 'awake'; since: number }
  | { state: 'unknown' };

/** Asleep when the newest sleep has no end; awake since the newest end otherwise. */
export function sleepState(events: BabyEvent[], now: number): SleepState {
  const last = latest(events, 'sleep', now);
  if (!last) return { state: 'unknown' };
  if (last.endAt == null) return { state: 'asleep', since: last.at, event: last };
  return { state: 'awake', since: Math.min(last.endAt, now) };
}

export interface SleepSession {
  event: BabyEvent;
  start: number;
  /** End time, or `now` while running. */
  end: number;
  running: boolean;
}

/** Sleep sessions overlapping [from, to), with running ones ending at `now`. */
export function sleepSessions(events: BabyEvent[], from: number, to: number, now: number): SleepSession[] {
  return events
    .filter((e) => e.kind === 'sleep')
    .map((e) => ({ event: e, start: e.at, end: e.endAt ?? now, running: e.endAt == null }))
    .filter((s) => s.start < to && s.end > from && s.end >= s.start)
    .sort((a, b) => b.start - a.start);
}

export interface DayTotals {
  feeds: number;
  breastFeeds: number;
  bottleFeeds: number;
  bottleMl: number;
  /** Milliseconds asleep inside the day (sessions clipped to the day, running ones up to now). */
  sleepMs: number;
  diapers: Record<DiaperKind, number>;
  diaperCount: number;
  pumpMl: number;
  pumps: number;
}

export function dayTotals(events: BabyEvent[], dayStart: number, now: number): DayTotals {
  const dayEnd = Math.min(addDays(dayStart, 1), Math.max(now, dayStart));
  const inDay = (t: number) => t >= dayStart && t < addDays(dayStart, 1);
  const t: DayTotals = {
    feeds: 0, breastFeeds: 0, bottleFeeds: 0, bottleMl: 0, sleepMs: 0,
    diapers: { wet: 0, dirty: 0, both: 0 }, diaperCount: 0, pumpMl: 0, pumps: 0,
  };
  for (const e of events) {
    if (e.kind === 'sleep' || !inDay(e.at) || e.at > now) continue;
    if (e.kind === 'feed') {
      t.feeds++;
      if (e.method === 'bottle') {
        t.bottleFeeds++;
        t.bottleMl += e.amountMl ?? 0;
      } else t.breastFeeds++;
    } else if (e.kind === 'diaper' && e.diaper) {
      t.diapers[e.diaper]++;
      t.diaperCount++;
    } else if (e.kind === 'pump') {
      t.pumps++;
      t.pumpMl += e.amountMl ?? 0;
    }
  }
  for (const s of sleepSessions(events, dayStart, dayEnd, now)) {
    t.sleepMs += Math.max(0, Math.min(s.end, dayEnd) - Math.max(s.start, dayStart));
  }
  return t;
}

/** "3 wet, 1 dirty, 2 both"; types with none are left out. */
export function diaperBreakdown(d: Record<DiaperKind, number>): string {
  const parts = (['wet', 'dirty', 'both'] as const).filter((k) => d[k] > 0).map((k) => `${d[k]} ${k}`);
  return parts.length ? parts.join(', ') : 'none yet';
}

/** Events shown on a day's timeline: anything starting that day, plus sleep overlapping it. Newest first. */
export function dayTimeline(events: BabyEvent[], dayStart: number, now: number): BabyEvent[] {
  const dayEnd = addDays(dayStart, 1);
  return events
    .filter((e) => {
      if (e.at >= dayStart && e.at < dayEnd) return true;
      if (e.kind !== 'sleep') return false;
      const end = e.endAt ?? now;
      return e.at < dayEnd && end > dayStart;
    })
    .sort(newestFirst);
}

/** One-line description for timeline rows and the undo toast. */
export function describeEvent(e: BabyEvent, now: number): string {
  switch (e.kind) {
    case 'feed':
      return e.method === 'bottle' ? `Bottle${e.amountMl ? `, ${e.amountMl} ml` : ''}` : `Feed, ${e.side ?? 'breast'}`;
    case 'sleep':
      return e.endAt == null ? `Sleeping, ${formatDuration(now - e.at)}` : `Sleep, ${formatDuration(e.endAt - e.at)}`;
    case 'diaper':
      return `Diaper, ${e.diaper ?? 'changed'}`;
    case 'pump':
      return `Pump${e.amountMl ? `, ${e.amountMl} ml` : ''}`;
  }
}

