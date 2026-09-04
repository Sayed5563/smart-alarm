import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './platform';

/**
 * The app-local `AlarmClock` Capacitor plugin (Java, in `android/app/.../`).
 * On the web the proxy exists but the methods reject — every call site guards
 * with `isNativeApp`.
 */
export interface AlarmFiredEvent {
  alarmId: string;
  kind: 'alarm' | 'pre-alarm' | 'snooze';
  at: number;
  firedKey: string;
  /** Set when the user hit Stop / Snooze on the notification instead of tapping it. */
  action?: 'stop' | 'snooze';
}

export interface AlarmClockPlugin {
  schedule(opts: {
    id: number;
    at: number;
    title: string;
    kind: string;
    alarmId: string;
    firedKey: string;
  }): Promise<void>;
  cancel(opts: { id: number }): Promise<void>;
  cancelAll(): Promise<void>;
  listScheduled(): Promise<{ ids: number[] }>;
  stopRinging(): Promise<void>;
  closeAlarmScreen(): Promise<void>;
  canScheduleExactAlarms(): Promise<{ granted: boolean }>;
  openExactAlarmSettings(): Promise<void>;
  canUseFullScreenIntent(): Promise<{ granted: boolean }>;
  openFullScreenIntentSettings(): Promise<void>;
  addListener(
    event: 'alarmFired',
    cb: (e: AlarmFiredEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

export const AlarmClock = registerPlugin<AlarmClockPlugin>('AlarmClock');

/** Stop the native ringing service (sound + vibration + foreground notif). No-op on web. */
export async function stopNativeAlarm(): Promise<void> {
  if (!isNativeApp) return;
  try {
    await AlarmClock.stopRinging();
  } catch {
    /* plugin missing / already stopped */
  }
}

/**
 * After Stop / Snooze, drop back to the lock screen / previous app instead of
 * leaving the full app open. No-op on web, or if the app wasn't alarm-launched.
 */
export async function closeNativeAlarmScreen(): Promise<void> {
  if (!isNativeApp) return;
  try {
    await AlarmClock.closeAlarmScreen();
  } catch {
    /* plugin missing */
  }
}
