/**
 * NotificationService — thin wrapper over the Web Notifications API.
 *
 * Browser reality (documented in the app's Help screen):
 * - Permission must be requested from a user gesture; we never ask on load.
 * - A notification can only be *shown* while the page/SW is alive. If the OS
 *   has fully killed the browser, nothing fires. This is not a bug we can fix
 *   in a PWA — it needs a native (Capacitor / AlarmManager) layer.
 * - We use the Service Worker registration to show notifications so they work
 *   when the tab is backgrounded but the SW is alive.
 */

type Perm = 'default' | 'granted' | 'denied' | 'unsupported';

class NotificationServiceImpl {
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  permission(): Perm {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission as Perm;
  }

  /** Call from a click. */
  async requestPermission(): Promise<Perm> {
    if (!this.isSupported()) return 'unsupported';
    try {
      const p = await Notification.requestPermission();
      return p as Perm;
    } catch {
      return this.permission();
    }
  }

  async notify(
    title: string,
    options: NotificationOptions & { tag?: string } = {},
  ): Promise<void> {
    if (this.permission() !== 'granted') return;
    const opts: NotificationOptions = {
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      silent: true, // our own AudioService owns the sound
      ...options,
    };
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) {
        await reg.showNotification(title, opts);
      } else {
        new Notification(title, opts);
      }
    } catch {
      /* ignore */
    }
  }

  async clear(tag: string): Promise<void> {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      const list = (await reg?.getNotifications({ tag })) ?? [];
      list.forEach((n) => n.close());
    } catch {
      /* ignore */
    }
  }
}

export const notificationService = new NotificationServiceImpl();
export type NotificationService = NotificationServiceImpl;
