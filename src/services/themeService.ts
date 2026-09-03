import type { AccentColor, ThemeMode } from '@/types';

/** Applies theme + accent to <html>. Kept out of React so the pre-paint inline
 *  script in index.html and the store can share one implementation shape. */
class ThemeServiceImpl {
  private mq: MediaQueryList | null =
    typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  private listener: (() => void) | null = null;

  apply(mode: ThemeMode, accent: AccentColor, reducedMotion: boolean): void {
    const root = document.documentElement;
    const dark = mode === 'dark' || (mode === 'system' && !!this.mq?.matches);
    root.classList.toggle('dark', dark);
    root.dataset.accent = accent;
    root.dataset.reducedMotion = reducedMotion ? 'true' : 'false';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#06070a' : '#eef0f4');
  }

  /** Re-apply when the OS theme flips while mode === 'system'. */
  watchSystem(onChange: () => void): () => void {
    this.unwatch();
    if (!this.mq) return () => {};
    this.listener = onChange;
    this.mq.addEventListener('change', onChange);
    return () => this.unwatch();
  }

  private unwatch(): void {
    if (this.mq && this.listener) this.mq.removeEventListener('change', this.listener);
    this.listener = null;
  }

  prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}

export const themeService = new ThemeServiceImpl();
export type ThemeService = ThemeServiceImpl;
