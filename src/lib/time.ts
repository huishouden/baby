import { daysBetween, parseYmd } from '@huishouden/pwa-kit/time';

// Baby's own wording; the shared time and date helpers are in @huishouden/pwa-kit/time.

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
  const days = daysBetween(now, due);
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
  const days = daysBetween(born, now);
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
