import { get, set, del, keys } from 'idb-keyval';

/**
 * StorageService — the single seam between the app and persistence.
 *
 * - Small structured state (alarms, settings, profiles, history) lives in
 *   localStorage via the zustand `persist` middleware (see store).
 * - Large binary blobs (uploaded audio, wallpapers) live in IndexedDB, keyed
 *   here. IndexedDB is used because localStorage is tiny and synchronous.
 *
 * A future Capacitor build can swap the implementation for the Filesystem /
 * Preferences plugins without touching callers.
 */

const SOUND_PREFIX = 'sound:';
const WALLPAPER_PREFIX = 'wallpaper:';

function safeLocalStorage(): Storage | null {
  try {
    const k = '__sa_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return null;
  }
}

export const storageService = {
  localStorageAvailable(): boolean {
    return safeLocalStorage() !== null;
  },

  async putSound(id: string, blob: Blob): Promise<void> {
    await set(SOUND_PREFIX + id, blob);
  },
  async getSound(id: string): Promise<Blob | undefined> {
    try {
      return await get<Blob>(SOUND_PREFIX + id);
    } catch {
      return undefined;
    }
  },
  async deleteSound(id: string): Promise<void> {
    await del(SOUND_PREFIX + id).catch(() => {});
  },

  async putWallpaper(id: string, blob: Blob): Promise<void> {
    await set(WALLPAPER_PREFIX + id, blob);
  },
  async getWallpaper(id: string): Promise<Blob | undefined> {
    try {
      return await get<Blob>(WALLPAPER_PREFIX + id);
    } catch {
      return undefined;
    }
  },
  async deleteWallpaper(id: string): Promise<void> {
    await del(WALLPAPER_PREFIX + id).catch(() => {});
  },

  /** Wipe every blob we own. Used by "Reset to default". */
  async clearAllBlobs(): Promise<void> {
    try {
      const all = await keys();
      await Promise.all(
        all
          .filter((k) => typeof k === 'string' && (k.startsWith(SOUND_PREFIX) || k.startsWith(WALLPAPER_PREFIX)))
          .map((k) => del(k)),
      );
    } catch {
      /* ignore — best effort */
    }
  },

  async estimate(): Promise<{ usage: number; quota: number } | null> {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
    }
    return null;
  },

  /** Ask the browser to keep our data from being auto-evicted. */
  async requestPersistent(): Promise<boolean> {
    try {
      if (navigator.storage?.persist) return await navigator.storage.persist();
    } catch {
      /* ignore */
    }
    return false;
  },
};

export type StorageService = typeof storageService;
