import { describe, expect, it } from 'vitest';
import { swipeIntent } from '@/components/SwipeRow';

describe('swipeIntent', () => {
  it('ignores tiny movement so a tap stays a tap', () => {
    expect(swipeIntent(5, 3)).toBe('none');
  });
  it('a mostly vertical drag is a scroll, never a swipe', () => {
    expect(swipeIntent(-20, 40)).toBe('vertical');
  });
  it('a mostly horizontal drag is a swipe', () => {
    expect(swipeIntent(-30, 6)).toBe('horizontal');
  });
});
