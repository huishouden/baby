// Time arithmetic and wording. Pure: every function takes `now` instead of reading the clock.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** "35m", "1h", "2h 10m", "1d 3h". Rounds down to the minute; under a minute is "0m". */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / MINUTE));
  const d = Math.floor(totalMin / (24 * 60));
  const h = Math.floor((totalMin % (24 * 60)) / 60);
  const m = totalMin % 60;
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/** "just now" under a minute, otherwise "2h 10m ago". */
export function formatAgo(at: number, now: number): string {
  const ms = now - at;
  if (ms < MINUTE) return 'just now';
  return `${formatDuration(ms)} ago`;
}

/** Hours with one decimal, for totals: "9.5 h". */
export function formatHours(ms: number): string {
  const h = Math.round((ms / HOUR) * 10) / 10;
  return `${h % 1 === 0 ? h.toFixed(0) : h.toFixed(1)} h`;
}

/** Local midnight at the start of the day containing `t`. */
export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local midnight `days` days after the day containing `t` (DST-safe). */
export function addDays(t: number, days: number): number {
  const d = new Date(startOfDay(t));
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** 'YYYY-MM-DD' to local midnight, or null when malformed. */
export function parseYmd(ymd: string | undefined): number | null {
  if (!ymd) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

export function toYmd(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole calendar days from the day of `from` to the day of `to` (negative when `to` is earlier). */
export function calendarDaysBetween(from: number, to: number): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY);
}

export interface Countdown {
  /** Calendar days until the due date; negative once it has passed. */
  days: number;
  /** The big phrase: "12 weeks", "9 days", "Due today", "3 days past". */
  headline: string;
  /** The phrase after the headline: "to go", "past the due date", or "". */
  suffix: string;
  /** Week of pregnancy counted the usual way (due date = end of week 40), when within 1 to 42. */
  week: number | null;
}

export function countdown(dueDate: string, now: number): Countdown | null {
  const due = parseYmd(dueDate);
  if (due === null) return null;
  const days = calendarDaysBetween(now, due);
  const week = Math.floor((280 - days) / 7) + 1;
  const w = week >= 1 && week <= 42 ? week : null;
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (days === 0) return { days, headline: 'Due today', suffix: '', week: w };
  if (days < 0) return { days, headline: plural(-days, 'day'), suffix: 'past the due date', week: w };
  if (days < 14) return { days, headline: plural(days, 'day'), suffix: 'to go', week: w };
  const weeks = Math.floor(days / 7);
  return { days, headline: plural(weeks, 'week'), suffix: 'to go', week: w };
}

/** "Born today", "5 days old", "3 weeks old", "4 months old". */
export function babyAge(birthDate: string, now: number): string | null {
  const born = parseYmd(birthDate);
  if (born === null) return null;
  const days = calendarDaysBetween(born, now);
  if (days < 0) return null;
  if (days === 0) return 'Born today';
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} old`;
  if (days < 7 * 9) return `${Math.floor(days / 7)} weeks old`;
  const b = new Date(born);
  const n = new Date(now);
  let months = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) months -= 1;
  if (months < 24) return `${months} months old`;
  return `${Math.floor(months / 12)} years old`;
}

/** Value for <input type="datetime-local">, in local time. */
export function toLocalInput(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : Math.round(t);
}

/** "Today", "Tomorrow", "In 5 days", "Yesterday", "12 days ago", by calendar day. */
export function relativeDay(t: number, now: number): string {
  const d = calendarDaysBetween(now, t);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  return d > 0 ? `In ${d} days` : `${-d} days ago`;
}
