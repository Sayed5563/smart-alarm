import { describe, expect, it, vi } from 'vitest';
import { backAction, goBack, parentOf, parseRoute, routeHash, tabFor, trackRoute } from '@/hooks/useHashRoute';

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

describe('backAction', () => {
  it('pops the history entry when we came from the parent, so system Back stays consistent', () => {
    expect(backAction('advanced', 'advanced')).toBe('pop');
  });
  it('replaces instead when we arrived some other way (deep link, notification)', () => {
    expect(backAction(null, 'advanced')).toBe('replace');
    expect(backAction('alarms', 'settings')).toBe('replace');
  });
});

describe('goBack double tap', () => {
  it('a second tap before the page changes does not go back twice', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    trackRoute('settings');
    trackRoute('advanced');
    trackRoute('history');
    goBack('advanced');
    goBack('advanced');
    expect(back).toHaveBeenCalledTimes(1);
    trackRoute('advanced'); // the pop landed
    goBack('settings');
    expect(back).toHaveBeenCalledTimes(2);
    back.mockRestore();
  });
});
