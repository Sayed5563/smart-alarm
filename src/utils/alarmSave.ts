import type { Alarm } from '@/types';
import { MAX_ALERT_DURATION_MINUTES } from '@/data/defaults';
import { clamp } from './time';

/**
 * What Save writes: the alarm on and armed fresh, like the iPhone and Pixel
 * clocks — except an alarm that's mid-snooze with its time and days unchanged
 * (say, just renamed) keeps the snooze, or that wake-up would be lost.
 * `original` is the live stored alarm, not the editor's possibly stale draft.
 */
export function prepareSave(draft: Alarm, original: Alarm, now: number): Alarm {
  const sameSlot =
    draft.hour === original.hour &&
    draft.minute === original.minute &&
    draft.repeat === original.repeat &&
    draft.customDays.join() === original.customDays.join();
  const snoozing = sameSlot && (original.snoozedUntil ?? 0) > now;
  return {
    ...draft,
    enabled: true,
    lastFiredKey: snoozing ? original.lastFiredKey : undefined,
    snoozedUntil: snoozing ? original.snoozedUntil : undefined,
    strongAlert: {
      ...draft.strongAlert,
      maxDurationMinutes: clamp(draft.strongAlert.maxDurationMinutes, 1, MAX_ALERT_DURATION_MINUTES),
    },
  };
}
