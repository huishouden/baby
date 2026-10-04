import type { BabyEvent, DiaperKind, Side } from './model';
import { latest, newestFirst, onDay, spans, timeWithin } from '@huishouden/pwa-kit/log';
import { addDays, formatDuration } from '@huishouden/pwa-kit/time';
import { t } from '../i18n';

// What the log screen shows at a glance, derived from the event list. Pure: `now` is passed in.
// The log maths (last entry, sleep spans, a day's entries) are @huishouden/pwa-kit/log; the
// wording and Baby's own totals are here.

/** Matches one kind of entry, for the kit's log functions: `latest(events, now, ofKind('feed'))`. */
export const ofKind =
  (kind: BabyEvent['kind']) =>
  (e: BabyEvent): boolean =>
    e.kind === kind;

const SIDE_KEYS = { left: 'side.left', right: 'side.right', both: 'side.both' } as const satisfies Record<Side, string>;
const DIAPER_KEYS = { wet: 'diaper.wet', dirty: 'diaper.dirty', both: 'diaper.both' } as const satisfies Record<DiaperKind, string>;

const COUNT_KEYS = { wet: 'diaper.countWet', dirty: 'diaper.countDirty', both: 'diaper.countBoth' } as const satisfies Record<DiaperKind, string>;

/** A breast feed's side in words ("left"), or "breast" when no side was noted. */
export const sideWords = (side: Side | undefined): string => (side ? t(SIDE_KEYS[side]) : t('side.breast'));

/** A diaper's kind in words ("wet"), or "changed" when none was noted. */
export const diaperWords = (kind: DiaperKind | undefined): string => (kind ? t(DIAPER_KEYS[kind]) : t('diaper.changed'));

/** "left", "bottle, 90 ml", "both". */
export function feedDetail(e: BabyEvent): string {
  if (e.method === 'bottle') return e.amountMl ? t('feed.bottleMl', { ml: e.amountMl }) : t('feed.bottle');
  return sideWords(e.side);
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
  const parts = (['wet', 'dirty', 'both'] as const).filter((k) => d[k] > 0).map((k) => t(COUNT_KEYS[k], { n: d[k] }));
  return parts.length ? parts.join(', ') : t('totals.noneYet');
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
      if (e.method === 'bottle') return e.amountMl ? t('event.bottleMl', { ml: e.amountMl }) : t('event.bottle');
      return t('event.feed', { side: sideWords(e.side) });
    case 'sleep':
      return e.endAt == null ? t('event.sleeping', { span: formatDuration(now - e.at) }) : t('event.sleep', { span: formatDuration(e.endAt - e.at) });
    case 'diaper':
      return t('event.diaper', { kind: diaperWords(e.diaper) });
    case 'pump':
      return e.amountMl ? t('event.pumpMl', { ml: e.amountMl }) : t('event.pump');
  }
}

