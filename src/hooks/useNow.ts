import { useEffect, useState } from 'react';

/**
 * A shared ticking clock. One timer for the whole app, re-aligned to the wall
 * clock on every tick so it never drifts and recovers immediately after the
 * device sleeps or the system clock changes.
 */
type Listener = (now: number) => void;
const listeners = new Set<Listener>();
let timer: number | null = null;

function schedule() {
  if (timer !== null) return;
  const tick = () => {
    timer = null;
    const now = Date.now();
    listeners.forEach((l) => l(now));
    if (listeners.size > 0) {
      const delay = 1000 - (Date.now() % 1000);
      timer = window.setTimeout(tick, delay);
    }
  };
  const delay = 1000 - (Date.now() % 1000);
  timer = window.setTimeout(tick, delay);
}

/** @param granularity 'second' updates every second; 'minute' only when the
 *  minute changes (cheaper for components that don't show seconds). */
export function useNow(granularity: 'second' | 'minute' = 'second'): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let lastMinute = new Date().getMinutes();
    const listener: Listener = (ms) => {
      const d = new Date(ms);
      if (granularity === 'minute') {
        if (d.getMinutes() === lastMinute) return;
        lastMinute = d.getMinutes();
      }
      setNow(d);
    };
    listeners.add(listener);
    schedule();

    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      listeners.delete(listener);
      document.removeEventListener('visibilitychange', onVisible);
      if (listeners.size === 0 && timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };
  }, [granularity]);

  return now;
}
