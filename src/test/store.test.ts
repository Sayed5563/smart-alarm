import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '@/store/useStore';
import { DEFAULT_SETTINGS } from '@/data/defaults';
import { prepareSave } from '@/utils/alarmSave';

// idb-keyval touches IndexedDB which jsdom lacks — stub the storage service.
vi.mock('@/services', async (orig) => {
  const actual = await orig<typeof import('@/services')>();
  return {
    ...actual,
    storageService: {
      ...actual.storageService,
      putSound: vi.fn().mockResolvedValue(undefined),
      deleteSound: vi.fn().mockResolvedValue(undefined),
      deleteWallpaper: vi.fn().mockResolvedValue(undefined),
      clearAllBlobs: vi.fn().mockResolvedValue(undefined),
    },
    audioService: { ...actual.audioService, forget: vi.fn() },
  };
});

function reset() {
  useStore.setState({
    alarms: [],
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
    profiles: [],
    activeProfileId: null,
    history: [],
    customSounds: [],
    customWallpapers: [],
    hasCustomWallpaper: false,
    ringing: null,
    lastDeleted: null,
  });
}

beforeEach(reset);

describe('alarm CRUD', () => {
  it('saving a snoozed one-off with only a new label keeps the snooze and the spent marker', () => {
    const now = Date.now();
    const a = useStore.getState().addAlarm({ repeat: 'once', hour: 7, minute: 0 });
    useStore.getState().updateAlarm(a.id, { lastFiredKey: 'k', snoozedUntil: now + 600_000 });
    const live = useStore.getState().alarms[0];
    useStore.getState().updateAlarm(a.id, prepareSave({ ...live, label: 'Renamed' }, live, now));
    const saved = useStore.getState().alarms[0];
    expect(saved.snoozedUntil).toBe(now + 600_000);
    expect(saved.lastFiredKey).toBe('k');
  });

  it('changing the time still re-arms a spent one-off', () => {
    const a = useStore.getState().addAlarm({ repeat: 'once', hour: 7, minute: 0 });
    useStore.getState().updateAlarm(a.id, { lastFiredKey: 'k' });
    useStore.getState().updateAlarm(a.id, { hour: 8 });
    expect(useStore.getState().alarms[0].lastFiredKey).toBeUndefined();
  });

  it('startTimer records the end and the length; cancel clears both', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    useStore.getState().startTimer(90_000);
    expect(useStore.getState().timerEndsAt).toBe(1_090_000);
    expect(useStore.getState().timerDurationMs).toBe(90_000);
    useStore.getState().cancelTimer();
    expect(useStore.getState().timerEndsAt).toBeNull();
    expect(useStore.getState().timerDurationMs).toBeNull();
    vi.useRealTimers();
  });

  it('undoDelete restores the alarm and its profile membership', () => {
    const a = useStore.getState().addAlarm({ label: 'Gym' });
    const p = useStore.getState().addProfile('Work');
    useStore.getState().setProfileAlarms(p.id, [a.id]);
    useStore.getState().deleteAlarm(a.id, { undoable: true });
    expect(useStore.getState().alarms).toHaveLength(0);

    useStore.getState().undoDelete(a.id);
    expect(useStore.getState().alarms.map((x) => x.label)).toEqual(['Gym']);
    expect(useStore.getState().profiles[0].activeAlarmIds).toEqual([a.id]);
    expect(useStore.getState().lastDeleted).toBeNull();
  });

  it('undoDelete only restores the most recent deletion, once', () => {
    const a = useStore.getState().addAlarm({ label: 'A' });
    const b = useStore.getState().addAlarm({ label: 'B' });
    useStore.getState().deleteAlarm(a.id, { undoable: true });
    useStore.getState().deleteAlarm(b.id, { undoable: true });
    useStore.getState().undoDelete(b.id);
    useStore.getState().undoDelete(b.id);
    expect(useStore.getState().alarms.map((x) => x.label)).toEqual(['B']);
  });

  it("a stale Undo for an earlier alarm never restores a different one", () => {
    const a = useStore.getState().addAlarm({ label: 'A' });
    const b = useStore.getState().addAlarm({ label: 'B' });
    useStore.getState().deleteAlarm(a.id, { undoable: true });
    useStore.getState().deleteAlarm(b.id, { undoable: true });
    useStore.getState().undoDelete(a.id);
    expect(useStore.getState().alarms).toHaveLength(0);
  });

  it('cancelling a new draft does not displace the Undo slot', () => {
    const a = useStore.getState().addAlarm({ label: 'A' });
    const draft = useStore.getState().addAlarm({ label: '' });
    useStore.getState().deleteAlarm(a.id, { undoable: true });
    useStore.getState().deleteAlarm(draft.id); // editor Cancel on a new alarm
    useStore.getState().undoDelete(a.id);
    expect(useStore.getState().alarms.map((x) => x.label)).toEqual(['A']);
  });

  it('undoDelete does nothing once the 5 s window has passed', () => {
    vi.useFakeTimers();
    const a = useStore.getState().addAlarm();
    useStore.getState().deleteAlarm(a.id, { undoable: true });
    vi.advanceTimersByTime(5_001);
    useStore.getState().undoDelete(a.id);
    expect(useStore.getState().alarms).toHaveLength(0);
    vi.useRealTimers();
  });

  it('adds an alarm with defaults from settings', () => {
    const a = useStore.getState().addAlarm();
    expect(useStore.getState().alarms).toHaveLength(1);
    expect(a.snoozeMinutes).toBe(DEFAULT_SETTINGS.defaults.snoozeMinutes);
    expect(a.volume).toBe(DEFAULT_SETTINGS.defaults.volume);
  });

  it('updates an alarm and clamps out-of-range values', () => {
    const a = useStore.getState().addAlarm();
    useStore.getState().updateAlarm(a.id, { volume: 5, snoozeMinutes: 999 });
    const updated = useStore.getState().alarms[0];
    expect(updated.volume).toBe(1);
    expect(updated.snoozeMinutes).toBe(60);
  });

  it('toggles enabled and clears any snooze', () => {
    const a = useStore.getState().addAlarm({ snoozedUntil: Date.now() + 1000 });
    useStore.getState().toggleAlarm(a.id, false);
    expect(useStore.getState().alarms[0].enabled).toBe(false);
    expect(useStore.getState().alarms[0].snoozedUntil).toBeUndefined();
  });

  it('deletes an alarm and removes it from profiles', () => {
    const a = useStore.getState().addAlarm();
    const p = useStore.getState().addProfile('Work');
    expect(p.activeAlarmIds).toContain(a.id);
    useStore.getState().deleteAlarm(a.id);
    expect(useStore.getState().alarms).toHaveLength(0);
    expect(useStore.getState().profiles[0].activeAlarmIds).not.toContain(a.id);
  });

  it('duplicates an alarm', () => {
    const a = useStore.getState().addAlarm({ label: 'Gym' });
    useStore.getState().duplicateAlarm(a.id);
    const [, copy] = useStore.getState().alarms;
    expect(copy.label).toBe('Gym (copy)');
    expect(copy.id).not.toBe(a.id);
  });

  it('quickSet creates a one-off alarm at now + N minutes', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 16, 30, 0));
    const a = useStore.getState().quickSet(5);
    expect(a.repeat).toBe('once');
    expect(a.hour).toBe(16);
    expect(a.minute).toBe(35);
    vi.useRealTimers();
  });
});

describe('profiles', () => {
  it('switching a profile never deletes alarms', () => {
    const a1 = useStore.getState().addAlarm({ label: 'A' });
    const a2 = useStore.getState().addAlarm({ label: 'B' });
    const weekend = useStore.getState().addProfile('Weekend');
    useStore.getState().setProfileAlarms(weekend.id, [a2.id]);
    useStore.getState().activateProfile(weekend.id);
    expect(useStore.getState().alarms).toHaveLength(2);
    expect(useStore.getState().activeAlarmIds()).toEqual([a2.id]);
    void a1;
  });

  it('no active profile means no gating', () => {
    useStore.getState().addAlarm();
    expect(useStore.getState().activeAlarmIds()).toBeNull();
  });
});

describe('ringing lifecycle', () => {
  it('snooze sets snoozedUntil without touching the recurring time', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 7, 0, 0));
    const a = useStore.getState().addAlarm({ hour: 7, minute: 0, repeat: 'daily', snoozeMinutes: 5 });
    useStore.getState().beginRing(useStore.getState().alarms[0], 'alarm');
    useStore.getState().addSnooze();
    const updated = useStore.getState().alarms[0];
    expect(updated.hour).toBe(7);
    expect(updated.minute).toBe(0);
    expect(updated.snoozedUntil).toBe(new Date(2026, 0, 1, 7, 5, 0).getTime());
    expect(useStore.getState().ringing).toBeNull();
    void a;
    vi.useRealTimers();
  });

  it('a "once" alarm disables itself after it is stopped', () => {
    const a = useStore.getState().addAlarm({ repeat: 'once' });
    useStore.getState().beginRing(useStore.getState().alarms[0], 'alarm');
    useStore.getState().endRing('dismissed-no-task');
    expect(useStore.getState().alarms[0].enabled).toBe(false);
    void a;
  });

  it('a repeating alarm stays enabled after being stopped', () => {
    useStore.getState().addAlarm({ repeat: 'daily' });
    useStore.getState().beginRing(useStore.getState().alarms[0], 'alarm');
    useStore.getState().endRing('completed', true);
    expect(useStore.getState().alarms[0].enabled).toBe(true);
    expect(useStore.getState().alarms[0].snoozedUntil).toBeUndefined();
  });

  it('test alarms never change the schedule and are flagged in history', () => {
    const a = useStore.getState().addAlarm({ repeat: 'once' });
    useStore.getState().beginRing({ ...useStore.getState().alarms[0] }, 'test');
    useStore.getState().endRing('completed', true);
    expect(useStore.getState().alarms[0].enabled).toBe(true); // untouched
    expect(useStore.getState().history[0].wasTest).toBe(true);
    void a;
  });

  it('history records snooze counts', () => {
    useStore.getState().addAlarm();
    useStore.getState().beginRing(useStore.getState().alarms[0], 'alarm');
    const id = useStore.getState().ringing!.id;
    useStore.getState().addSnooze();
    expect(useStore.getState().history.find((h) => h.id === id)?.snoozeCount).toBe(1);
  });
});

describe('reset & import', () => {
  it('resetAll wipes everything back to defaults', async () => {
    useStore.getState().addAlarm();
    useStore.getState().addProfile('X');
    await useStore.getState().resetAll();
    const s = useStore.getState();
    expect(s.alarms).toHaveLength(0);
    expect(s.profiles).toHaveLength(0);
    expect(s.history).toHaveLength(0);
    expect(s.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('importBundle sanitizes hostile values', () => {
    useStore.getState().importBundle({
      version: 1,
      exportedAt: 0,
      alarms: [
        // @ts-expect-error deliberately malformed
        { hour: 99, minute: -3, volume: 12, snoozeMinutes: 0, repeat: 'nonsense' },
      ],
      settings: DEFAULT_SETTINGS,
      profiles: [],
      activeProfileId: null,
      history: [],
      customSounds: [],
      customWallpapers: [],
    });
    const a = useStore.getState().alarms[0];
    expect(a.hour).toBe(23);
    expect(a.minute).toBe(0);
    expect(a.volume).toBe(1);
    expect(a.snoozeMinutes).toBe(1);
    expect(a.repeat).toBe('once');
  });
});
