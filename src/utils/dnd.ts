import type { Alarm, DndConfig } from '@/types';
import { minutesSinceMidnight } from './time';

/** Is `date` inside the quiet-hours window? Handles windows that wrap past
 *  midnight (e.g. 22:00 -> 07:00). */
export function isWithinDnd(date: Date, dnd: DndConfig): boolean {
  if (!dnd.enabled) return false;
  const now = minutesSinceMidnight(date.getHours(), date.getMinutes());
  const start = minutesSinceMidnight(dnd.startHour, dnd.startMinute);
  const end = minutesSinceMidnight(dnd.endHour, dnd.endMinute);
  if (start === end) return false; // zero-length window
  if (start < end) return now >= start && now < end;
  return now >= start || now < end; // wraps midnight
}

/**
 * Decide whether an alarm scheduled for `at` should be suppressed by the
 * app-level quiet period. NOTE: a browser PWA cannot control the operating
 * system's real Do Not Disturb — this is an in-app quiet period only.
 */
export function isAlarmSuppressedByDnd(
  alarm: Pick<Alarm, 'importance' | 'dndOverride'>,
  at: Date,
  dnd: DndConfig,
): boolean {
  if (!isWithinDnd(at, dnd)) return false;
  if (dnd.behavior === 'mute') return true;
  // allow-important
  const isPrivileged = alarm.importance === 'important' || alarm.dndOverride;
  return !isPrivileged;
}
