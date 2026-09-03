import type { Alarm, ExportBundle } from '@/types';
import { MAX_ALERT_DURATION_MINUTES } from '@/data/defaults';
import { clamp } from './time';

/** Coerce a possibly-corrupt alarm object into a valid one. Never throws. */
export function sanitizeAlarm(raw: unknown, fallback: Alarm): Alarm {
  const a = (raw ?? {}) as Partial<Alarm>;
  const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
  const fadeIn = [0, 10, 30, 60, 300].includes(num(a.fadeInSeconds, fallback.fadeInSeconds))
    ? (a.fadeInSeconds as Alarm['fadeInSeconds'])
    : fallback.fadeInSeconds;
  return {
    ...fallback,
    ...a,
    id: typeof a.id === 'string' && a.id ? a.id : fallback.id,
    label: typeof a.label === 'string' ? a.label.slice(0, 80) : fallback.label,
    hour: clamp(Math.trunc(num(a.hour, fallback.hour)), 0, 23),
    minute: clamp(Math.trunc(num(a.minute, fallback.minute)), 0, 59),
    volume: clamp(num(a.volume, fallback.volume), 0, 1),
    snoozeMinutes: clamp(Math.trunc(num(a.snoozeMinutes, fallback.snoozeMinutes)), 1, 60),
    fadeInSeconds: fadeIn,
    customDays: Array.isArray(a.customDays)
      ? (a.customDays.filter((d) => typeof d === 'number' && d >= 0 && d <= 6) as Alarm['customDays'])
      : fallback.customDays,
    enabled: typeof a.enabled === 'boolean' ? a.enabled : fallback.enabled,
    repeat: (['once', 'daily', 'weekdays', 'weekends', 'custom'] as const).includes(a.repeat as never)
      ? (a.repeat as Alarm['repeat'])
      : fallback.repeat,
    importance: a.importance === 'important' ? 'important' : 'normal',
    strongAlert: {
      enabled: Boolean(a.strongAlert?.enabled),
      maxDurationMinutes: clamp(
        Math.trunc(num(a.strongAlert?.maxDurationMinutes, 15)),
        1,
        MAX_ALERT_DURATION_MINUTES,
      ),
    },
    preAlarm: {
      enabled: Boolean(a.preAlarm?.enabled),
      minutesBefore: clamp(Math.trunc(num(a.preAlarm?.minutesBefore, 5)), 1, 30),
      soundId: typeof a.preAlarm?.soundId === 'string' ? a.preAlarm.soundId : fallback.preAlarm.soundId,
      volume: clamp(num(a.preAlarm?.volume, 0.35), 0, 1),
    },
    afterStop: {
      enabled: Boolean(a.afterStop?.enabled),
      soundId: typeof a.afterStop?.soundId === 'string' ? a.afterStop.soundId : fallback.afterStop.soundId,
      volume: clamp(num(a.afterStop?.volume, 0.6), 0, 1),
      behavior: a.afterStop?.behavior === 'must-finish' ? 'must-finish' : 'stoppable',
    },
    wakeUpTask: {
      type: (['none', 'math', 'code', 'sequence', 'qr'] as const).includes(a.wakeUpTask?.type as never)
        ? (a.wakeUpTask!.type as Alarm['wakeUpTask']['type'])
        : 'none',
      difficulty: (['easy', 'medium', 'hard'] as const).includes(a.wakeUpTask?.difficulty as never)
        ? (a.wakeUpTask!.difficulty as Alarm['wakeUpTask']['difficulty'])
        : 'easy',
      rounds: clamp(Math.trunc(num(a.wakeUpTask?.rounds, 1)), 1, 5),
      qrPayload: typeof a.wakeUpTask?.qrPayload === 'string' ? a.wakeUpTask.qrPayload : undefined,
    },
    snoozedUntil: undefined,
    lastFiredKey: undefined,
  };
}

export function isPlausibleExportBundle(x: unknown): x is ExportBundle {
  if (!x || typeof x !== 'object') return false;
  const b = x as Record<string, unknown>;
  return (
    b.version === 1 &&
    Array.isArray(b.alarms) &&
    typeof b.settings === 'object' &&
    b.settings !== null &&
    Array.isArray(b.profiles) &&
    Array.isArray(b.history)
  );
}

export const ACCEPTED_AUDIO_MIME = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/x-m4a', 'audio/aac', 'audio/mp4'];
export const ACCEPTED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // pre-resize

export function validateUpload(
  file: File,
  kind: 'audio' | 'image',
): { ok: true } | { ok: false; reason: string } {
  const accepted = kind === 'audio' ? ACCEPTED_AUDIO_MIME : ACCEPTED_IMAGE_MIME;
  const maxBytes = kind === 'audio' ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
  if (file.type && !accepted.includes(file.type)) {
    return { ok: false, reason: `Unsupported file type: ${file.type || 'unknown'}` };
  }
  if (file.size > maxBytes) {
    return { ok: false, reason: `File too large (max ${(maxBytes / 1024 / 1024).toFixed(0)} MB)` };
  }
  return { ok: true };
}
