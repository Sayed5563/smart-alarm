import { describe, expect, it, vi } from 'vitest';
import { untilHidden } from './nativeAlarm';

describe('untilHidden', () => {
  it('waits for the page to go hidden, not just for the cap', async () => {
    vi.useFakeTimers();
    let done = false;
    void untilHidden(1500).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(100);
    expect(done).toBe(false);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
    vi.useRealTimers();
  });
});
