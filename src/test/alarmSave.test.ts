import { describe, expect, it } from 'vitest';
import { makeAlarm, DEFAULT_SETTINGS, MAX_ALERT_DURATION_MINUTES } from '@/data/defaults';
import { prepareSave } from '@/utils/alarmSave';

describe('prepareSave', () => {
  it('saving turns the alarm on and re-arms a spent one-off, even with no time change', () => {
    const spent = makeAlarm(DEFAULT_SETTINGS, { repeat: 'once', enabled: false, lastFiredKey: 'k' });
    const saved = prepareSave(spent);
    expect(saved.enabled).toBe(true);
    expect(saved.lastFiredKey).toBeUndefined();
  });
  it('clamps the strong-alert cap', () => {
    const a = makeAlarm(DEFAULT_SETTINGS, { strongAlert: { enabled: true, maxDurationMinutes: 999 } });
    expect(prepareSave(a).strongAlert.maxDurationMinutes).toBe(MAX_ALERT_DURATION_MINUTES);
  });
});
