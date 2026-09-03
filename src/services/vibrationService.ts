import type { VibrationPattern } from '@/types';

/** Feature-detected wrapper around the Vibration API. Everything degrades to a
 *  no-op when unsupported (desktop, iOS Safari, etc.). */

const PATTERNS: Record<Exclude<VibrationPattern, 'off'>, number[]> = {
  short: [200, 150, 200],
  medium: [400, 200, 400, 200, 400],
  strong: [700, 250, 700, 250, 700, 250, 700],
};

class VibrationServiceImpl {
  private repeatTimer: number | null = null;

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  buzz(pattern: VibrationPattern): void {
    if (pattern === 'off' || !this.isSupported()) return;
    try {
      navigator.vibrate(PATTERNS[pattern]);
    } catch {
      /* ignore */
    }
  }

  /** Used by Strong Alert mode: re-buzz until stopped. */
  startRepeating(pattern: VibrationPattern, everyMs = 5000): void {
    if (pattern === 'off' || !this.isSupported()) return;
    this.stop();
    this.buzz(pattern);
    this.repeatTimer = window.setInterval(() => this.buzz(pattern), everyMs);
  }

  stop(): void {
    if (this.repeatTimer !== null) {
      clearInterval(this.repeatTimer);
      this.repeatTimer = null;
    }
    if (this.isSupported()) {
      try {
        navigator.vibrate(0);
      } catch {
        /* ignore */
      }
    }
  }
}

export const vibrationService = new VibrationServiceImpl();
export type VibrationService = VibrationServiceImpl;
