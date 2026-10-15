import type { Alarm } from '@/types';

/** The list order: by clock time, so it doesn't reshuffle every time an alarm rings. */
export function sortByTimeOfDay(alarms: Alarm[]): Alarm[] {
  return [...alarms].sort(
    (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute) || a.createdAt - b.createdAt,
  );
}

/**
 * A one-off alarm that already rang: shown as off until it's switched back on.
 * A snooze still pending means it hasn't finished ringing yet.
 */
export function isSpent(
  a: Pick<Alarm, 'repeat' | 'lastFiredKey' | 'snoozedUntil'>,
  now = Date.now(),
): boolean {
  return a.repeat === 'once' && !!a.lastFiredKey && !((a.snoozedUntil ?? 0) > now);
}

/** The header line for what rings next — say so when it's a pre-alarm or a snooze. */
export function nextInKey(kind: 'alarm' | 'pre-alarm' | 'snooze'): 'alarms.nextIn' | 'alarms.preAlarmIn' | 'alarms.snoozeIn' {
  return kind === 'pre-alarm' ? 'alarms.preAlarmIn' : kind === 'snooze' ? 'alarms.snoozeIn' : 'alarms.nextIn';
}
