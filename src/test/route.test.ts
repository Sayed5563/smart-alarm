import { describe, expect, it } from 'vitest';
import { parseRoute } from '@/hooks/useHashRoute';

describe('parseRoute', () => {
  it('maps the tabs', () => {
    expect(parseRoute('#/alarms')).toBe('alarms');
    expect(parseRoute('#/timer')).toBe('timer');
    expect(parseRoute('#/settings')).toBe('settings');
  });
  it('keeps old links working', () => {
    expect(parseRoute('#/home')).toBe('alarms');
    expect(parseRoute('#/history')).toBe('history');
    expect(parseRoute('')).toBe('alarms');
    expect(parseRoute('#/nonsense')).toBe('alarms');
  });
});
