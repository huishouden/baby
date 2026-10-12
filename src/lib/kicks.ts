import { HOUR, MINUTE, parseYmd, toYmd } from '@huishouden/pwa-kit/time';
import type { KickSession, KickSettings } from './model';
import { LIMITS } from './model';
import { DEFAULT_KICK_TARGET, KICK_REF, KICK_REMIND_DAYS, clampKickTarget } from '@huishouden/pwa-kit/baby-settings';

// The kick counter's maths. Pure: `now` is passed in. Nothing here diagnoses: it counts movements,
// times them, and says when the common "10 movements in 2 hours" guide has not been met.

/** Baby's default and limits are the kit's (`@huishouden/pwa-kit/baby-settings`), which the assistant's tool uses too. */
export const DEFAULT_TARGET = DEFAULT_KICK_TARGET;
/** The common guide: 10 movements within 2 hours. A session still under its target after this long means call. */
export const CALL_AFTER = 2 * HOUR;
/** The strip shows this many days, ending today. */
export const STRIP_DAYS = 14;
/** A strip bar is full at this many minutes (the call threshold). */
export const STRIP_MAX = CALL_AFTER;

export const targetOf = (settings: Pick<KickSettings, 'target'> | null | undefined): number => clampTarget(settings?.target ?? DEFAULT_TARGET);

export const clampTarget = clampKickTarget;

export const isRunning = (s: KickSession): boolean => s.end == null;
/** Reached its target: the target-th movement was counted. */
export const reachedTarget = (s: KickSession): boolean => s.taps.length >= s.target;

/** The session in progress (the newest without an end). */
export function running(list: KickSession[]): KickSession | undefined {
  return list.filter(isRunning).sort((a, b) => b.start - a.start)[0];
}

/** Milliseconds from the start to the target-th movement, or null when it was not reached. */
export function timeToTarget(s: KickSession): number | null {
  return reachedTarget(s) ? s.taps[s.target - 1] - s.start : null;
}

/** How long the session ran (to its end, or to now while it goes on). */
export const lengthOf = (s: KickSession, now: number): number => Math.max(0, (s.end ?? now) - s.start);

/** Still under the target after two hours: the guide says call now. A finished or stopped session no longer asks. */
export const needsCall = (s: KickSession, now: number): boolean => isRunning(s) && !reachedTarget(s) && now - s.start >= CALL_AFTER;

/** Newest first. */
export const newestFirst = (list: KickSession[]): KickSession[] => [...list].sort((a, b) => b.start - a.start);

/** The id for a session starting at `start`: the day itself for the day's first, else the day and a number. */
export function sessionId(start: number, taken: Iterable<string>): string {
  const ids = new Set(taken);
  const day = toYmd(start);
  if (!ids.has(day)) return day;
  for (let n = 2; ; n++) if (!ids.has(`${day}-${n}`)) return `${day}-${n}`;
}

/** The session with a movement counted now; reaching the target ends it at that movement. Null when it already ended. */
export function withTap(s: KickSession, at: number): KickSession | null {
  if (!isRunning(s) || s.taps.length >= LIMITS.kickTaps) return null;
  const taps = [...s.taps, Math.max(at, s.start)];
  const next: KickSession = { ...s, taps, updatedAt: at };
  if (taps.length >= s.target) next.end = taps[taps.length - 1];
  return next;
}

/** The session without its last movement; one that ended by reaching the target runs again. Null when there is none. */
export function withoutLastTap(s: KickSession, at: number): KickSession | null {
  if (s.taps.length === 0) return null;
  const last = s.taps[s.taps.length - 1];
  const { end, ...rest } = s;
  const reopened = end != null && end === last && s.taps.length - 1 < s.target;
  return { ...(reopened ? rest : s), taps: s.taps.slice(0, -1), updatedAt: at };
}

export interface Day {
  /** YYYY-MM-DD. */
  ymd: string;
  /** The day's first session, if any. */
  session?: KickSession;
  /** Minutes to the target; null when there was no session or it did not reach the target. */
  minutes: number | null;
}

/** The last `days` days, oldest first, ending with today: each day's first session and its time to target. */
export function strip(list: KickSession[], now: number, days = STRIP_DAYS): Day[] {
  const first = new Map<string, KickSession>();
  for (const s of [...list].sort((a, b) => a.start - b.start)) {
    const ymd = toYmd(s.start);
    if (!first.has(ymd)) first.set(ymd, s);
  }
  const out: Day[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ymd = toYmd(d.getTime());
    const session = first.get(ymd);
    const ms = session ? timeToTarget(session) : null;
    out.push({ ymd, ...(session ? { session } : {}), minutes: ms == null ? null : Math.max(1, Math.round(ms / MINUTE)) });
  }
  return out;
}

/** Whole minutes for a span, at least 1: "23". */
export const minutesOf = (ms: number): number => Math.max(1, Math.round(ms / MINUTE));

/** "1:05" for 65 seconds, "12:30" for 12 minutes 30 seconds; hours roll into minutes ("75:00"). */
export function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The local time `hhmm` on the day `ymd`, or null for a malformed one. */
export function atLocal(ymd: string, hhmm: string): number | null {
  const day = parseYmd(ymd);
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (day == null || !m) return null;
  const d = new Date(day);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.getTime();
}

/** How many days ahead the daily reminder is scheduled; each time the app opens it rolls forward. */
export const REMIND_DAYS = KICK_REMIND_DAYS;

/** The daily reminder's day-ref prefix. */
export { KICK_REF };
