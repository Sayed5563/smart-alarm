import { describe, expect, it } from 'vitest';
import { makeAlarm, DEFAULT_SETTINGS } from '@/data/defaults';
import { sanitizeAlarm } from '@/utils/validation';

const base = makeAlarm(DEFAULT_SETTINGS);

describe('sanitizeAlarm runtime state', () => {
  it('keeps a spent marker and an active snooze when restoring saved state', () => {
    const saved = { ...base, repeat: 'once', lastFiredKey: '2026-9-15-14-15', snoozedUntil: 123 };
    const a = sanitizeAlarm(saved, base, { keepRuntimeState: true });
    expect(a.lastFiredKey).toBe('2026-9-15-14-15');
    expect(a.snoozedUntil).toBe(123);
  });

  it('drops them for an imported backup (the default)', () => {
    const saved = { ...base, lastFiredKey: 'k', snoozedUntil: 123 };
    const a = sanitizeAlarm(saved, base);
    expect(a.lastFiredKey).toBeUndefined();
    expect(a.snoozedUntil).toBeUndefined();
  });

  it('ignores runtime fields of the wrong type', () => {
    const saved = { ...base, lastFiredKey: 42, snoozedUntil: 'soon' };
    const a = sanitizeAlarm(saved, base, { keepRuntimeState: true });
    expect(a.lastFiredKey).toBeUndefined();
    expect(a.snoozedUntil).toBeUndefined();
  });
});
