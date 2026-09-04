import type { Alarm, AppSettings } from '@/types';
import { nextOccurrence, DAY_MS } from './time';
import { isAlarmSuppressedByDnd } from './dnd';

export type ScheduledEventKind = 'alarm' | 'pre-alarm' | 'snooze';

export interface ScheduledEvent {
  alarmId: string;
  kind: ScheduledEventKind;
  at: number;
}

/**
 * The soonest event this single alarm will produce after `now`, accounting for
 * repeat rules, an active snooze, the pre-alarm, and the app-level quiet period.
 * Pure — no timers, no side effects. This is the unit the scheduler and the
 * tests exercise.
 */
export function nextEventForAlarm(
  alarm: Alarm,
  settings: AppSettings,
  now: number,
): ScheduledEvent | null {
  if (!alarm.enabled) return null;

  // An active snooze wins outright and is never muted — the user asked for it.
  if (alarm.snoozedUntil && alarm.snoozedUntil > now) {
    return { alarmId: alarm.id, kind: 'snooze', at: alarm.snoozedUntil };
  }

  // A 'once' alarm that already rang is spent — no phantom occurrence tomorrow.
  if (alarm.repeat === 'once' && alarm.lastFiredKey) return null;

  // Find the next occurrence that isn't suppressed by quiet hours. For repeating
  // alarms we skip forward day by day; for 'once' a suppressed occurrence is
  // simply dropped.
  let cursor = now;
  let mainAt: number | null = null;
  for (let i = 0; i < 9; i++) {
    const occ = nextOccurrence(alarm, new Date(cursor));
    if (occ == null) break;
    if (!isAlarmSuppressedByDnd(alarm, new Date(occ), settings.dnd)) {
      mainAt = occ;
      break;
    }
    if (alarm.repeat === 'once') break;
    cursor = occ + 1; // step past this occurrence and try the next day
    if (cursor > now + 8 * DAY_MS) break;
  }
  if (mainAt == null) return null;

  const candidates: ScheduledEvent[] = [{ alarmId: alarm.id, kind: 'alarm', at: mainAt }];

  if (alarm.preAlarm.enabled) {
    const preAt = mainAt - alarm.preAlarm.minutesBefore * 60_000;
    if (preAt > now) candidates.push({ alarmId: alarm.id, kind: 'pre-alarm', at: preAt });
  }

  candidates.sort((a, b) => a.at - b.at);
  return candidates[0];
}

/** The soonest event across every active alarm, or null if nothing is pending. */
export function nextEvent(
  alarms: Alarm[],
  settings: AppSettings,
  activeAlarmIds: string[] | null,
  now: number,
): ScheduledEvent | null {
  let best: ScheduledEvent | null = null;
  for (const alarm of alarms) {
    if (activeAlarmIds && !activeAlarmIds.includes(alarm.id)) continue;
    const ev = nextEventForAlarm(alarm, settings, now);
    if (ev && (!best || ev.at < best.at)) best = ev;
  }
  return best;
}

/**
 * Every event to hand to the OS scheduler (native build): for each active alarm,
 * its next `occurrencesPerAlarm` main occurrences plus their pre-alarms, and any
 * active snooze. Unlike `nextEventForAlarm` this returns the *set* to register,
 * because on a closed phone nothing re-runs `sync()` between fires.
 */
export function scheduleSet(
  alarms: Alarm[],
  settings: AppSettings,
  activeAlarmIds: string[] | null,
  now: number,
  opts: { horizonMs: number; occurrencesPerAlarm: number } = {
    horizonMs: 14 * DAY_MS,
    occurrencesPerAlarm: 3,
  },
): ScheduledEvent[] {
  const out: ScheduledEvent[] = [];
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    if (activeAlarmIds && !activeAlarmIds.includes(alarm.id)) continue;

    if (alarm.snoozedUntil && alarm.snoozedUntil > now) {
      out.push({ alarmId: alarm.id, kind: 'snooze', at: alarm.snoozedUntil });
    }

    // A 'once' alarm that already rang is spent — don't re-arm it for tomorrow.
    if (alarm.repeat === 'once' && alarm.lastFiredKey) continue;

    let cursor = now;
    for (let n = 0; n < opts.occurrencesPerAlarm; n++) {
      let mainAt: number | null = null;
      for (let i = 0; i < 9; i++) {
        const occ = nextOccurrence(alarm, new Date(cursor));
        if (occ == null) break;
        if (!isAlarmSuppressedByDnd(alarm, new Date(occ), settings.dnd)) {
          mainAt = occ;
          break;
        }
        if (alarm.repeat === 'once') break;
        cursor = occ + 1;
        if (cursor > now + 8 * DAY_MS) break;
      }
      if (mainAt == null) break;
      if (mainAt - now > opts.horizonMs) break;

      out.push({ alarmId: alarm.id, kind: 'alarm', at: mainAt });
      if (alarm.preAlarm.enabled) {
        const preAt = mainAt - alarm.preAlarm.minutesBefore * 60_000;
        if (preAt > now && preAt - now <= opts.horizonMs) {
          out.push({ alarmId: alarm.id, kind: 'pre-alarm', at: preAt });
        }
      }
      cursor = mainAt + 1;
      if (alarm.repeat === 'once') break;
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** All events across all active alarms within `horizonMs` — used by the
 *  "upcoming alarm" notification and the Home screen next-alarm card. */
export function upcomingEvents(
  alarms: Alarm[],
  settings: AppSettings,
  activeAlarmIds: string[] | null,
  now: number,
  horizonMs: number,
): ScheduledEvent[] {
  const out: ScheduledEvent[] = [];
  for (const alarm of alarms) {
    if (activeAlarmIds && !activeAlarmIds.includes(alarm.id)) continue;
    const ev = nextEventForAlarm(alarm, settings, now);
    if (ev && ev.at - now <= horizonMs) out.push(ev);
  }
  return out.sort((a, b) => a.at - b.at);
}
