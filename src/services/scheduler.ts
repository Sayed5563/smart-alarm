import { Capacitor } from '@capacitor/core';
import { alarmScheduler } from './alarmScheduler';
import { nativeAlarmScheduler } from './nativeAlarmScheduler';
import type { SchedulerLike } from './alarmScheduler';

/**
 * The one scheduler `App` talks to. On a Capacitor build it's the native
 * AlarmManager-backed scheduler (alarms fire when the app is closed); in a
 * browser it's the single-timer web scheduler.
 */
export const scheduler: SchedulerLike = Capacitor.isNativePlatform()
  ? nativeAlarmScheduler
  : alarmScheduler;

export const isNativeApp = Capacitor.isNativePlatform();
