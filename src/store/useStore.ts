import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Alarm,
  AlarmHistoryEntry,
  AppSettings,
  CustomSoundMeta,
  CustomWallpaperMeta,
  DndConfig,
  ExportBundle,
  HistoryOutcome,
  ID,
  Profile,
  RingingSession,
} from '@/types';
import { DEFAULT_SETTINGS, makeAlarm, MAX_ALERT_DURATION_MINUTES } from '@/data/defaults';
import { sanitizeAlarm } from '@/utils/validation';
import { newId } from '@/utils/id';
import { clamp } from '@/utils/time';
import { storageService, audioService } from '@/services';

const STORAGE_KEY = 'smart-alarm:v1';
const HISTORY_LIMIT = 250;

export interface StoreState {
  alarms: Alarm[];
  settings: AppSettings;
  profiles: Profile[];
  activeProfileId: ID | null;
  history: AlarmHistoryEntry[];
  customSounds: CustomSoundMeta[];
  customWallpapers: CustomWallpaperMeta[];
  hasCustomWallpaper: boolean;

  /** In-memory only. */
  ringing: RingingSession | null;
  lastToast: { id: number; message: string } | null;

  // ---- alarms
  addAlarm: (partial?: Partial<Alarm>) => Alarm;
  updateAlarm: (id: ID, patch: Partial<Alarm>) => void;
  deleteAlarm: (id: ID) => void;
  toggleAlarm: (id: ID, enabled?: boolean) => void;
  duplicateAlarm: (id: ID) => void;
  quickSet: (minutesFromNow: number) => Alarm;

  // ---- settings
  updateSettings: (patch: Partial<AppSettings>) => void;
  updateDefaults: (patch: Partial<AppSettings['defaults']>) => void;
  updateDnd: (patch: Partial<DndConfig>) => void;
  setAudioUnlocked: (v: boolean) => void;

  // ---- profiles
  activeAlarmIds: () => ID[] | null;
  addProfile: (name: string) => Profile;
  renameProfile: (id: ID, name: string) => void;
  duplicateProfile: (id: ID) => void;
  deleteProfile: (id: ID) => void;
  activateProfile: (id: ID | null) => void;
  setProfileAlarms: (id: ID, alarmIds: ID[]) => void;

  // ---- custom media
  addCustomSound: (file: File) => Promise<CustomSoundMeta | { error: string }>;
  deleteCustomSound: (id: ID) => Promise<void>;
  setCustomWallpaper: (meta: CustomWallpaperMeta) => void;
  clearCustomWallpaper: () => Promise<void>;

  // ---- history
  clearHistory: () => void;

  // ---- ringing lifecycle
  beginRing: (alarm: Alarm, kind: RingingSession['kind']) => void;
  addSnooze: () => void;
  recordTaskFailure: () => void;
  setRingPhase: (phase: RingingSession['phase']) => void;
  endRing: (outcome: HistoryOutcome, taskCompleted?: boolean) => void;

  // ---- data
  exportBundle: () => ExportBundle;
  importBundle: (bundle: ExportBundle) => void;
  resetAll: () => Promise<void>;
  toast: (message: string) => void;
}

function cloneDefaults(): AppSettings {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as AppSettings;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      alarms: [],
      settings: cloneDefaults(),
      profiles: [],
      activeProfileId: null,
      history: [],
      customSounds: [],
      customWallpapers: [],
      hasCustomWallpaper: false,
      ringing: null,
      lastToast: null,

      addAlarm: (partial) => {
        const alarm = makeAlarm(get().settings, partial);
        set((s) => ({ alarms: [...s.alarms, alarm] }));
        // New alarms join the active profile automatically.
        const pid = get().activeProfileId;
        if (pid) {
          set((s) => ({
            profiles: s.profiles.map((p) =>
              p.id === pid ? { ...p, activeAlarmIds: [...p.activeAlarmIds, alarm.id] } : p,
            ),
          }));
        }
        return alarm;
      },

      updateAlarm: (id, patch) =>
        set((s) => ({
          alarms: s.alarms.map((a) => {
            if (a.id !== id) return a;
            const next = { ...a, ...patch } as Alarm;
            next.strongAlert.maxDurationMinutes = clamp(
              next.strongAlert.maxDurationMinutes,
              1,
              MAX_ALERT_DURATION_MINUTES,
            );
            next.volume = clamp(next.volume, 0, 1);
            next.snoozeMinutes = clamp(Math.trunc(next.snoozeMinutes), 1, 60);
            return next;
          }),
        })),

      deleteAlarm: (id) =>
        set((s) => ({
          alarms: s.alarms.filter((a) => a.id !== id),
          profiles: s.profiles.map((p) => ({
            ...p,
            activeAlarmIds: p.activeAlarmIds.filter((x) => x !== id),
          })),
          ringing: s.ringing?.alarmId === id ? null : s.ringing,
        })),

      toggleAlarm: (id, enabled) =>
        set((s) => ({
          alarms: s.alarms.map((a) =>
            a.id === id ? { ...a, enabled: enabled ?? !a.enabled, snoozedUntil: undefined } : a,
          ),
        })),

      duplicateAlarm: (id) => {
        const src = get().alarms.find((a) => a.id === id);
        if (!src) return;
        get().addAlarm({
          ...src,
          id: undefined,
          label: src.label ? `${src.label} (copy)` : '',
          createdAt: Date.now(),
          snoozedUntil: undefined,
          lastFiredKey: undefined,
        });
      },

      quickSet: (minutesFromNow) => {
        const t = new Date(Date.now() + minutesFromNow * 60_000);
        return get().addAlarm({
          hour: t.getHours(),
          minute: t.getMinutes(),
          repeat: 'once',
          label: `+${minutesFromNow} min`,
          category: 'other',
        });
      },

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      updateDefaults: (patch) =>
        set((s) => ({ settings: { ...s.settings, defaults: { ...s.settings.defaults, ...patch } } })),
      updateDnd: (patch) =>
        set((s) => ({ settings: { ...s.settings, dnd: { ...s.settings.dnd, ...patch } } })),
      setAudioUnlocked: (v) => set((s) => ({ settings: { ...s.settings, audioUnlocked: v } })),

      activeAlarmIds: () => {
        const { activeProfileId, profiles } = get();
        if (!activeProfileId) return null;
        return profiles.find((p) => p.id === activeProfileId)?.activeAlarmIds ?? null;
      },

      addProfile: (name) => {
        const profile: Profile = {
          id: newId(),
          name: name.trim() || 'Profile',
          activeAlarmIds: get().alarms.map((a) => a.id),
          createdAt: Date.now(),
        };
        set((s) => ({ profiles: [...s.profiles, profile] }));
        return profile;
      },
      renameProfile: (id, name) =>
        set((s) => ({
          profiles: s.profiles.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)),
        })),
      duplicateProfile: (id) => {
        const src = get().profiles.find((p) => p.id === id);
        if (!src) return;
        set((s) => ({
          profiles: [
            ...s.profiles,
            { ...src, id: newId(), name: `${src.name} (copy)`, createdAt: Date.now() },
          ],
        }));
      },
      deleteProfile: (id) =>
        set((s) => ({
          profiles: s.profiles.filter((p) => p.id !== id),
          activeProfileId: s.activeProfileId === id ? null : s.activeProfileId,
        })),
      activateProfile: (id) => set({ activeProfileId: id }),
      setProfileAlarms: (id, alarmIds) =>
        set((s) => ({
          profiles: s.profiles.map((p) => (p.id === id ? { ...p, activeAlarmIds: [...alarmIds] } : p)),
        })),

      addCustomSound: async (file) => {
        const id = newId();
        try {
          await storageService.putSound(id, file);
        } catch {
          return { error: 'Could not save this file (storage may be full).' };
        }
        const meta: CustomSoundMeta = {
          id,
          name: file.name.replace(/\.[^.]+$/, '') || 'Custom sound',
          mime: file.type || 'audio/mpeg',
          size: file.size,
          createdAt: Date.now(),
        };
        set((s) => ({ customSounds: [...s.customSounds, meta] }));
        return meta;
      },
      deleteCustomSound: async (id) => {
        await storageService.deleteSound(id);
        audioService.forget(`custom:${id}`);
        set((s) => ({
          customSounds: s.customSounds.filter((c) => c.id !== id),
          alarms: s.alarms.map((a) =>
            a.soundId === `custom:${id}` ? { ...a, soundId: s.settings.defaults.soundId } : a,
          ),
        }));
      },
      setCustomWallpaper: (meta) =>
        set((s) => ({
          customWallpapers: [meta],
          hasCustomWallpaper: true,
          settings: { ...s.settings, wallpaperId: 'custom' },
        })),
      clearCustomWallpaper: async () => {
        const metas = get().customWallpapers;
        await Promise.all(metas.map((m) => storageService.deleteWallpaper(m.id)));
        set((s) => ({
          customWallpapers: [],
          hasCustomWallpaper: false,
          settings:
            s.settings.wallpaperId === 'custom'
              ? { ...s.settings, wallpaperId: DEFAULT_SETTINGS.wallpaperId }
              : s.settings,
        }));
      },

      clearHistory: () => set({ history: [] }),

      beginRing: (alarm, kind) => {
        const now = Date.now();
        const session: RingingSession = {
          id: newId(),
          alarmId: alarm.id,
          alarm,
          kind,
          startedAt: now,
          snoozeCount: alarm.snoozedUntil ? 1 : 0,
          wakeTaskFailures: 0,
          phase: 'ringing',
        };
        set({ ringing: session });

        if (kind === 'alarm' || kind === 'test' || kind === 'timer') {
          const entry: AlarmHistoryEntry = {
            id: session.id,
            alarmId: alarm.id,
            alarmLabel: alarm.label || (kind === 'timer' ? 'Timer' : 'Alarm'),
            category: alarm.category,
            triggeredAt: now,
            snoozeCount: 0,
            wakeTaskRequired: alarm.wakeUpTask.type !== 'none',
            wakeTaskFailures: 0,
            outcome: 'missed',
            wasTest: kind === 'test',
            wasTimer: kind === 'timer',
          };
          set((s) => ({ history: [entry, ...s.history].slice(0, HISTORY_LIMIT) }));
        }

        // Clear the fired-occurrence marker for 'once' alarms handled in endRing.
        if (kind === 'alarm') {
          set((s) => ({
            alarms: s.alarms.map((a) =>
              a.id === alarm.id ? { ...a, lastFiredKey: `${now}` } : a,
            ),
          }));
        }
      },

      addSnooze: () => {
        const r = get().ringing;
        if (!r) return;
        const mins = r.alarm.snoozeMinutes;
        const until = Date.now() + mins * 60_000;
        set((s) => ({
          alarms: s.alarms.map((a) => (a.id === r.alarmId ? { ...a, snoozedUntil: until } : a)),
          ringing: null,
          history: s.history.map((h) =>
            h.id === r.id ? { ...h, snoozeCount: h.snoozeCount + 1, outcome: 'missed' } : h,
          ),
        }));
      },

      recordTaskFailure: () =>
        set((s) => ({
          ringing: s.ringing
            ? { ...s.ringing, wakeTaskFailures: s.ringing.wakeTaskFailures + 1 }
            : null,
          history: s.ringing
            ? s.history.map((h) =>
                h.id === s.ringing!.id ? { ...h, wakeTaskFailures: h.wakeTaskFailures + 1 } : h,
              )
            : s.history,
        })),

      setRingPhase: (phase) =>
        set((s) => ({ ringing: s.ringing ? { ...s.ringing, phase } : null })),

      endRing: (outcome, taskCompleted) => {
        const r = get().ringing;
        set({ ringing: null });
        if (!r) return;

        // 'once' alarms disable themselves after ringing; clear any snooze.
        set((s) => ({
          alarms: s.alarms.map((a) => {
            if (a.id !== r.alarmId) return a;
            const cleared = { ...a, snoozedUntil: undefined };
            if (r.kind === 'alarm' && a.repeat === 'once') cleared.enabled = false;
            return cleared;
          }),
        }));

        if (r.kind === 'pre-alarm') return;

        set((s) => ({
          history: s.history.map((h) =>
            h.id === r.id
              ? {
                  ...h,
                  stoppedAt: Date.now(),
                  outcome,
                  wakeTaskCompleted: h.wakeTaskRequired ? Boolean(taskCompleted) : undefined,
                }
              : h,
          ),
        }));
      },

      exportBundle: () => {
        const s = get();
        return {
          version: 1,
          exportedAt: Date.now(),
          alarms: s.alarms.map((a) => ({ ...a, snoozedUntil: undefined, lastFiredKey: undefined })),
          settings: s.settings,
          profiles: s.profiles,
          activeProfileId: s.activeProfileId,
          history: s.history,
          customSounds: s.customSounds,
          customWallpapers: s.customWallpapers,
        };
      },

      importBundle: (bundle) => {
        const base = makeAlarm(DEFAULT_SETTINGS);
        set({
          alarms: bundle.alarms.map((a) => sanitizeAlarm(a, { ...base, id: newId() })),
          settings: { ...cloneDefaults(), ...bundle.settings, audioUnlocked: false },
          profiles: Array.isArray(bundle.profiles) ? bundle.profiles : [],
          activeProfileId: bundle.activeProfileId ?? null,
          history: Array.isArray(bundle.history) ? bundle.history.slice(0, HISTORY_LIMIT) : [],
        });
      },

      resetAll: async () => {
        await storageService.clearAllBlobs();
        set({
          alarms: [],
          settings: cloneDefaults(),
          profiles: [],
          activeProfileId: null,
          history: [],
          customSounds: [],
          customWallpapers: [],
          hasCustomWallpaper: false,
          ringing: null,
        });
      },

      toast: (message) => set({ lastToast: { id: Date.now(), message } }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => {
        try {
          localStorage.getItem('x');
          return localStorage;
        } catch {
          // Memory fallback so the app still runs when storage is blocked.
          const mem = new Map<string, string>();
          return {
            getItem: (k: string) => mem.get(k) ?? null,
            setItem: (k: string, v: string) => void mem.set(k, v),
            removeItem: (k: string) => void mem.delete(k),
          };
        }
      }),
      partialize: (s) => ({
        alarms: s.alarms,
        settings: s.settings,
        profiles: s.profiles,
        activeProfileId: s.activeProfileId,
        history: s.history,
        customSounds: s.customSounds,
        customWallpapers: s.customWallpapers,
        hasCustomWallpaper: s.hasCustomWallpaper,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StoreState>;
        const base = makeAlarm(DEFAULT_SETTINGS);
        return {
          ...current,
          ...p,
          settings: { ...cloneDefaults(), ...(p.settings ?? {}) },
          alarms: Array.isArray(p.alarms)
            ? p.alarms.map((a) => sanitizeAlarm(a, { ...base, id: newId() }))
            : [],
          history: Array.isArray(p.history) ? p.history.slice(0, HISTORY_LIMIT) : [],
          profiles: Array.isArray(p.profiles) ? p.profiles : [],
          ringing: null,
          lastToast: null,
        };
      },
    },
  ),
);
