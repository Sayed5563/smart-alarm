import { describe, expect, it } from 'vitest';
import { parentOf, parseRoute, routeHash, tabFor } from '@/hooks/useHashRoute';

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

describe('settings sub-pages', () => {
  it('parses the nested hashes', () => {
    expect(parseRoute('#/settings/advanced')).toBe('advanced');
    expect(parseRoute('#/settings/advanced/history')).toBe('history');
  });
  it('round-trips every route through its hash', () => {
    for (const r of ['alarms', 'timer', 'settings', 'advanced', 'history'] as const) {
      expect(parseRoute(routeHash(r))).toBe(r);
    }
  });
  it('keeps the Settings tab lit on its sub-pages', () => {
    expect(tabFor('advanced')).toBe('settings');
    expect(tabFor('history')).toBe('settings');
    expect(tabFor('timer')).toBe('timer');
  });
  it('back goes up one level, never to wherever the browser came from', () => {
    expect(parentOf('history')).toBe('advanced');
    expect(parentOf('advanced')).toBe('settings');
    expect(parentOf('alarms')).toBeNull();
  });
});
