import type { Alarm } from '@/types';
import { MAX_ALERT_DURATION_MINUTES } from '@/data/defaults';
import { clamp } from './time';

/** What Save writes: the alarm on and armed fresh, like the iPhone and Pixel clocks. */
export function prepareSave(draft: Alarm): Alarm {
  return {
    ...draft,
    enabled: true,
    lastFiredKey: undefined,
    snoozedUntil: undefined,
    strongAlert: {
      ...draft.strongAlert,
      maxDurationMinutes: clamp(draft.strongAlert.maxDurationMinutes, 1, MAX_ALERT_DURATION_MINUTES),
    },
  };
}
