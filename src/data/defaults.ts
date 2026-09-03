import type { Alarm, AppSettings } from '@/types';
import { DEFAULT_SOUND_ID, PRE_ALARM_SOUND_ID } from './sounds';
import { DEFAULT_WALLPAPER_ID } from './wallpapers';
import { newId } from '@/utils/id';

/** Hard safety cap: a Strong Alert alarm can never be configured to run
 *  longer than this, regardless of imported data. */
export const MAX_ALERT_DURATION_MINUTES = 30;

export const DEFAULT_SETTINGS: AppSettings = {
  clockType: 'digital',
  clockFont: 'classic',
  hour24: false,
  showSeconds: true,
  theme: 'system',
  accent: 'amber',
  wallpaperId: DEFAULT_WALLPAPER_ID,
  reducedMotion: false,
  notificationsEnabled: false,
  preAlarmDefaultLeadNotice: true,
  dnd: {
    enabled: false,
    startHour: 22,
    startMinute: 0,
    endHour: 7,
    endMinute: 0,
    behavior: 'allow-important',
  },
  defaults: {
    snoozeMinutes: 5,
    volume: 0.7,
    fadeInSeconds: 10,
    soundId: DEFAULT_SOUND_ID,
    vibration: 'medium',
    wakeUpTask: 'none',
    strongAlert: false,
  },
  language: 'en',
  audioUnlocked: false,
};

export function makeAlarm(settings: AppSettings, overrides: Partial<Alarm> = {}): Alarm {
  const d = settings.defaults;
  return {
    id: newId(),
    label: '',
    category: 'personal',
    enabled: true,
    hour: 7,
    minute: 0,
    repeat: 'once',
    customDays: [],
    soundId: d.soundId,
    volume: d.volume,
    fadeInSeconds: d.fadeInSeconds,
    snoozeMinutes: d.snoozeMinutes,
    vibration: d.vibration,
    importance: 'normal',
    dndOverride: false,
    preAlarm: {
      enabled: false,
      minutesBefore: 5,
      soundId: PRE_ALARM_SOUND_ID,
      volume: 0.35,
    },
    afterStop: {
      enabled: false,
      soundId: 'builtin:rising-tone',
      volume: 0.6,
      behavior: 'stoppable',
    },
    wakeUpTask: {
      type: d.wakeUpTask,
      difficulty: 'easy',
      rounds: 1,
    },
    strongAlert: {
      enabled: d.strongAlert,
      maxDurationMinutes: 15,
    },
    createdAt: Date.now(),
    ...overrides,
  };
}
