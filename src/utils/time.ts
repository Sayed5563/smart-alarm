import type { Alarm, RepeatMode, Weekday } from '@/types';

export const DAY_MS = 86_400_000;
export const MINUTE_MS = 60_000;

export function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Format a Date's clock time. */
export function formatClock(
  date: Date,
  opts: { hour24: boolean; showSeconds: boolean },
): { main: string; suffix: string } {
  const s = date.getSeconds();
  const m = date.getMinutes();
  let h = date.getHours();
  let suffix = '';
  if (!opts.hour24) {
    suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
  }
  const hh = opts.hour24 ? pad2(h) : String(h);
  let main = `${hh}:${pad2(m)}`;
  if (opts.showSeconds) main += `:${pad2(s)}`;
  return { main, suffix };
}

/** Format an alarm's set time (hour/minute) for display. */
export function formatAlarmTime(hour: number, minute: number, hour24: boolean): string {
  if (hour24) return `${pad2(hour)}:${pad2(minute)}`;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  let h = hour % 12;
  if (h === 0) h = 12;
  return `${h}:${pad2(minute)} ${suffix}`;
}

export const REPEAT_TO_DAYS: Record<Exclude<RepeatMode, 'once' | 'custom'>, Weekday[]> = {
  daily: [0, 1, 2, 3, 4, 5, 6],
  weekdays: [1, 2, 3, 4, 5],
  weekends: [0, 6],
};

/** Resolve an alarm's repeat config into the concrete set of weekdays it fires
 *  on. Returns [] for 'once' (meaning: a single upcoming occurrence). */
export function repeatDays(alarm: Pick<Alarm, 'repeat' | 'customDays'>): Weekday[] {
  if (alarm.repeat === 'once') return [];
  if (alarm.repeat === 'custom') return [...alarm.customDays].sort((a, b) => a - b);
  return REPEAT_TO_DAYS[alarm.repeat];
}

function atTime(base: Date, hour: number, minute: number): Date {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/**
 * Next epoch-ms this alarm's H:M should ring, strictly after `from`.
 * Returns null when the alarm can never ring (e.g. custom repeat with no days).
 * Ignores enabled/snooze/DND — the scheduler layers those on top.
 */
export function nextOccurrence(
  alarm: Pick<Alarm, 'hour' | 'minute' | 'repeat' | 'customDays'>,
  from: Date = new Date(),
): number | null {
  const days = repeatDays(alarm);

  if (alarm.repeat === 'once') {
    const today = atTime(from, alarm.hour, alarm.minute);
    if (today.getTime() > from.getTime()) return today.getTime();
    return today.getTime() + DAY_MS;
  }

  if (days.length === 0) return null;

  for (let offset = 0; offset <= 7; offset++) {
    const cand = atTime(new Date(from.getTime() + offset * DAY_MS), alarm.hour, alarm.minute);
    if (cand.getTime() <= from.getTime()) continue;
    if (days.includes(cand.getDay() as Weekday)) return cand.getTime();
  }
  return null;
}

/** "6h 32m", "58m", "in a moment". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  const totalMin = Math.round(ms / MINUTE_MS);
  if (totalMin < 1) return '<1m';
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function minutesSinceMidnight(hour: number, minute: number): number {
  return hour * 60 + minute;
}

/** Minute-resolution key used to de-dupe fires within the same clock minute. */
export function minuteKey(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
}
