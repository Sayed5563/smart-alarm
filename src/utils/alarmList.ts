import type { Alarm } from '@/types';

/** The list order: by clock time, so it doesn't reshuffle every time an alarm rings. */
export function sortByTimeOfDay(alarms: Alarm[]): Alarm[] {
  return [...alarms].sort(
    (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute) || a.createdAt - b.createdAt,
  );
}

/** A one-off alarm that already rang: shown as off until it's switched back on. */
export function isSpent(a: Pick<Alarm, 'repeat' | 'lastFiredKey'>): boolean {
  return a.repeat === 'once' && !!a.lastFiredKey;
}
