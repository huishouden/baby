import type { BabyEvent, DiaperKind } from './model';
import { latest, newestFirst, onDay, spans, timeWithin } from '@huishouden/pwa-kit/log';
import { addDays, formatDuration } from '@huishouden/pwa-kit/time';

// What the log screen shows at a glance, derived from the event list. Pure: `now` is passed in.
// The log maths (last entry, sleep spans, a day's entries) are @huishouden/pwa-kit/log; the
// wording and Baby's own totals are here.

/** Matches one kind of entry, for the kit's log functions: `latest(events, now, ofKind('feed'))`. */
export const ofKind =
  (kind: BabyEvent['kind']) =>
  (e: BabyEvent): boolean =>
    e.kind === kind;

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
  const last = latest(events, now, ofKind('sleep'));
  if (!last) return { state: 'unknown' };
  if (last.endAt == null) return { state: 'asleep', since: last.at, event: last };
  return { state: 'awake', since: Math.min(last.endAt, now) };
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
  t.sleepMs = timeWithin(events, dayStart, addDays(dayStart, 1), now, ofKind('sleep'));
  return t;
}

/** "3 wet, 1 dirty, 2 both"; types with none are left out. */
export function diaperBreakdown(d: Record<DiaperKind, number>): string {
  const parts = (['wet', 'dirty', 'both'] as const).filter((k) => d[k] > 0).map((k) => `${d[k]} ${k}`);
  return parts.length ? parts.join(', ') : 'none yet';
}

/** Events shown on a day's timeline: anything starting that day, plus sleep overlapping it. Newest first. */
export function dayTimeline(events: BabyEvent[], dayStart: number, now: number): BabyEvent[] {
  const started = onDay(events, dayStart);
  const overlapping = spans(events, dayStart, addDays(dayStart, 1), now, ofKind('sleep')).map((s) => s.entry);
  return [...new Set([...started, ...overlapping])].sort(newestFirst);
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

