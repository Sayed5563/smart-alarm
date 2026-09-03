/**
 * UpdateService — backs the "Check for updates" button.
 *
 * The app auto-updates: `vite-plugin-pwa` is in `autoUpdate` mode, so when the
 * browser next notices a new service worker it activates it and reloads. That
 * check normally happens on app open / navigation. This service just lets the
 * user force that check now instead of waiting.
 */

type Registration = ServiceWorkerRegistration;

export type UpdateResult = 'updating' | 'current' | 'offline' | 'unsupported';

class UpdateServiceImpl {
  private registration: Registration | undefined;

  /** Called once from the service-worker registration callback in main.tsx. */
  setRegistration(reg: Registration | undefined): void {
    this.registration = reg;
  }

  isSupported(): boolean {
    return !!this.registration;
  }

  /**
   * Ask the browser to re-fetch the service worker. If a newer one exists it
   * starts installing; `autoUpdate` then reloads the page on its own, so a
   * 'updating' result means "a reload is coming".
   */
  async check(): Promise<UpdateResult> {
    const reg = this.registration;
    if (!reg) return 'unsupported';
    try {
      await reg.update();
    } catch {
      return 'offline';
    }
    return reg.installing || reg.waiting ? 'updating' : 'current';
  }
}

export const updateService = new UpdateServiceImpl();
export type UpdateService = UpdateServiceImpl;
