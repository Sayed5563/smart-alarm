/** Domain types for Smart Alarm. Kept framework-agnostic so a future
 *  Capacitor/native layer can reuse them unchanged. */

export type ID = string;

/** 0 = Sunday ... 6 = Saturday (matches Date.getDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RepeatMode =
  | 'once'
  | 'daily'
  | 'weekdays'
  | 'weekends'
  | 'custom';

export type AlarmCategory =
  | 'work'
  | 'school'
  | 'gym'
  | 'study'
  | 'personal'
  | 'other';

export type Importance = 'normal' | 'important';

export type WakeUpTaskType = 'none' | 'math' | 'code' | 'sequence' | 'qr';
export type WakeUpDifficulty = 'easy' | 'medium' | 'hard';

export interface WakeUpTaskConfig {
  type: WakeUpTaskType;
  difficulty: WakeUpDifficulty;
  /** How many problems must be solved in a row to dismiss. */
  rounds: number;
  /** For the 'qr' task: the exact payload the scanned code must contain. */
  qrPayload?: string;
}

export type AfterStopBehavior = 'stoppable' | 'must-finish';

export interface AfterStopConfig {
  enabled: boolean;
  soundId: SoundRef;
  volume: number; // 0..1
  behavior: AfterStopBehavior;
}

export interface PreAlarmConfig {
  enabled: boolean;
  minutesBefore: number; // 1..30
  soundId: SoundRef;
  volume: number; // 0..1
}

export type FadeInDuration = 0 | 10 | 30 | 60 | 300; // seconds; 0 = off

export type VibrationPattern = 'off' | 'short' | 'medium' | 'strong';

/** A reference to a sound: a built-in id ("builtin:soft-piano") or a
 *  custom uploaded sound ("custom:<uuid>"). */
export type SoundRef = string;

export interface Alarm {
  id: ID;
  label: string;
  category: AlarmCategory;
  enabled: boolean;
  /** Local wall-clock time. */
  hour: number; // 0..23
  minute: number; // 0..59
  repeat: RepeatMode;
  /** Only meaningful when repeat === 'custom'. */
  customDays: Weekday[];
  soundId: SoundRef;
  volume: number; // 0..1
  fadeInSeconds: FadeInDuration;
  snoozeMinutes: number; // > 0
  vibration: VibrationPattern;
  importance: Importance;
  /** If true, this alarm is allowed to ring even during quiet hours. */
  dndOverride: boolean;
  preAlarm: PreAlarmConfig;
  afterStop: AfterStopConfig;
  wakeUpTask: WakeUpTaskConfig;
  strongAlert: {
    enabled: boolean;
    maxDurationMinutes: number; // safety cap, hard-limited
  };
  createdAt: number;
  /** Transient snooze target (epoch ms). Cleared when the alarm is stopped.
   *  Does not affect the recurring schedule. */
  snoozedUntil?: number;
  /** Bookkeeping: last epoch-ms occurrence we already fired, to avoid
   *  double-firing within the same minute. */
  lastFiredKey?: string;
}

export type ClockType = 'digital' | 'analog';
export type ClockFont = 'classic' | 'digital' | 'minimal';
export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentColor = 'blue' | 'purple' | 'green';

export interface DndConfig {
  enabled: boolean;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  /** 'mute' skips normal alarms entirely; 'allow-important' lets important
   *  (or dndOverride) alarms through. */
  behavior: 'mute' | 'allow-important';
}

export interface AppSettings {
  clockType: ClockType;
  clockFont: ClockFont;
  hour24: boolean;
  showSeconds: boolean;
  theme: ThemeMode;
  accent: AccentColor;
  wallpaperId: string; // "builtin:*" | "custom" | "none"
  reducedMotion: boolean;
  notificationsEnabled: boolean;
  preAlarmDefaultLeadNotice: boolean;
  dnd: DndConfig;
  /** Defaults applied to newly-created alarms. */
  defaults: {
    snoozeMinutes: number;
    volume: number;
    fadeInSeconds: FadeInDuration;
    soundId: SoundRef;
    vibration: VibrationPattern;
    wakeUpTask: WakeUpTaskType;
    strongAlert: boolean;
  };
  language: string;
  /** Set once the user has completed the "enable sound" gesture. */
  audioUnlocked: boolean;
}

export interface Profile {
  id: ID;
  name: string;
  /** Alarm ids that are active while this profile is selected.
   *  Alarms not listed are simply dormant, never deleted. */
  activeAlarmIds: ID[];
  createdAt: number;
}

export interface CustomSoundMeta {
  id: ID; // stored under SoundRef "custom:<id>"
  name: string;
  mime: string;
  size: number;
  createdAt: number;
}

export interface CustomWallpaperMeta {
  id: ID;
  name: string;
  width: number;
  height: number;
  createdAt: number;
}

export type HistoryOutcome =
  | 'completed'
  | 'dismissed-no-task'
  | 'auto-stopped'
  | 'missed';

export interface AlarmHistoryEntry {
  id: ID;
  alarmId: ID;
  alarmLabel: string;
  category: AlarmCategory;
  /** When the alarm first started ringing. */
  triggeredAt: number;
  /** When it was finally stopped (or auto-stopped). */
  stoppedAt?: number;
  snoozeCount: number;
  wakeTaskRequired: boolean;
  wakeTaskCompleted?: boolean;
  wakeTaskFailures: number;
  outcome: HistoryOutcome;
  wasTest: boolean;
  wasTimer: boolean;
}

export interface BuiltinSound {
  id: SoundRef; // "builtin:*"
  name: string;
  group: 'gentle' | 'energetic' | 'fun';
  /** Web-Audio synth recipe (no external files). */
  recipe: SoundRecipe;
}

export interface SoundRecipe {
  /** Base oscillator type. */
  wave: OscillatorType;
  /** Sequence of note frequencies (Hz) played on a loop. */
  notes: number[];
  /** Seconds per note. */
  noteDuration: number;
  /** Gap between loop repeats, seconds. */
  loopGap: number;
  /** Attack/release envelope in seconds. */
  attack: number;
  release: number;
  /** Optional second detuned oscillator for richness. */
  detune?: number;
  /** Optional low-frequency tremolo, Hz (0 = none). */
  tremolo?: number;
}

export interface BuiltinWallpaper {
  id: string; // "builtin:*"
  name: string;
  pack: 'minimal' | 'gradient' | 'nature' | 'abstract' | 'night-sky';
  /** A CSS background value (gradient / layered gradients). No image files. */
  css: string;
  /** Suggested foreground treatment. */
  scrim: 'light' | 'dark';
}

/** The active ringing session — lives only in memory, never persisted. */
export interface RingingSession {
  id: ID;
  alarmId: ID;
  alarm: Alarm;
  kind: 'alarm' | 'pre-alarm' | 'test' | 'timer';
  startedAt: number;
  snoozeCount: number;
  wakeTaskFailures: number;
  /** Set when the after-stop sound is playing. */
  phase: 'ringing' | 'after-stop' | 'done';
}

export interface ExportBundle {
  version: 1;
  exportedAt: number;
  alarms: Alarm[];
  settings: AppSettings;
  profiles: Profile[];
  activeProfileId: ID | null;
  history: AlarmHistoryEntry[];
  /** Custom media is referenced by metadata only; blobs are not embedded. */
  customSounds: CustomSoundMeta[];
  customWallpapers: CustomWallpaperMeta[];
}
