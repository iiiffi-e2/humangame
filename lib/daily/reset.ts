/**
 * Daily reset boundary.
 *
 * v1 resets at 00:00 UTC for everybody, which is why every helper here takes
 * or returns a `YYYY-MM-DD` string rather than a `Date`. All reset logic
 * lives in this one file so a later move to local-midnight or a fixed
 * regional cutoff touches nothing else.
 */

/** Day 1 of HUMAN. Do not change after launch — it defines every day number. */
export const HUMAN_EPOCH = '2026-03-13';

const MS_PER_DAY = 86_400_000;

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateKey(key: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error(`Bad date key: ${key}`);
  const parsed = new Date(`${key}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Bad date key: ${key}`);
  return parsed;
}

/** The date key of the daily currently live at `now`. */
export function currentDateKey(now: Date = new Date()): string {
  return toDateKey(now);
}

export function dayNumberFor(dateKey: string): number {
  const days = Math.round(
    (parseDateKey(dateKey).getTime() - parseDateKey(HUMAN_EPOCH).getTime()) / MS_PER_DAY,
  );
  return days + 1;
}

export function dateKeyForDayNumber(dayNumber: number): string {
  const time = parseDateKey(HUMAN_EPOCH).getTime() + (dayNumber - 1) * MS_PER_DAY;
  return toDateKey(new Date(time));
}

export function addDays(dateKey: string, days: number): string {
  return toDateKey(new Date(parseDateKey(dateKey).getTime() + days * MS_PER_DAY));
}

/** Milliseconds until the next reset. */
export function msUntilReset(now: Date = new Date()): number {
  const nextMidnight = parseDateKey(toDateKey(now)).getTime() + MS_PER_DAY;
  return Math.max(0, nextMidnight - now.getTime());
}

export function formatCountdown(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/** `SEP 12` — the compact date stamp used beside the day number. */
export function formatStamp(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  return `${month} ${date.getUTCDate()}`;
}

/** Whether two date keys are consecutive days — the streak rule. */
export function isNextDay(previous: string, current: string): boolean {
  return addDays(previous, 1) === current;
}
