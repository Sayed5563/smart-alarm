import { describe, expect, it } from 'vitest';
import { makeAlarm, DEFAULT_SETTINGS, MAX_ALERT_DURATION_MINUTES } from '@/data/defaults';
import { prepareSave } from '@/utils/alarmSave';

describe('prepareSave', () => {
  it('saving turns the alarm on and re-arms a spent one-off, even with no time change', () => {
    const spent = makeAlarm(DEFAULT_SETTINGS, { repeat: 'once', enabled: false, lastFiredKey: 'k' });
    const saved = prepareSave(spent, spent, Date.now());
    expect(saved.enabled).toBe(true);
    expect(saved.lastFiredKey).toBeUndefined();
  });
  it('keeps a pending snooze (and the spent marker) when only the label changed', () => {
    const now = 1_000_000;
    const original = makeAlarm(DEFAULT_SETTINGS, {
      repeat: 'once', hour: 7, minute: 0, lastFiredKey: 'k', snoozedUntil: now + 600_000,
    });
    const saved = prepareSave({ ...original, label: 'Renamed' }, original, now);
    expect(saved.snoozedUntil).toBe(now + 600_000);
    expect(saved.lastFiredKey).toBe('k');
    expect(saved.enabled).toBe(true);
  });

  it('drops the snooze once the time or days change', () => {
    const now = 1_000_000;
    const original = makeAlarm(DEFAULT_SETTINGS, { hour: 7, minute: 0, snoozedUntil: now + 600_000 });
    expect(prepareSave({ ...original, minute: 30 }, original, now).snoozedUntil).toBeUndefined();
    expect(prepareSave({ ...original, repeat: 'daily' }, original, now).snoozedUntil).toBeUndefined();
  });

  it('clamps the strong-alert cap', () => {
    const a = makeAlarm(DEFAULT_SETTINGS, { strongAlert: { enabled: true, maxDurationMinutes: 999 } });
    expect(prepareSave(a, a, Date.now()).strongAlert.maxDurationMinutes).toBe(MAX_ALERT_DURATION_MINUTES);
  });
});
