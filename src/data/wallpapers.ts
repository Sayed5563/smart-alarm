import type { BuiltinWallpaper } from '@/types';

/** Wallpapers are pure CSS (gradients) — no image files ship with the app.
 *  Users can still upload their own image, stored locally in IndexedDB. */
export const BUILTIN_WALLPAPERS: BuiltinWallpaper[] = [
  // Minimal
  { id: 'builtin:minimal-dark', name: 'Ink', pack: 'minimal', scrim: 'dark', css: 'radial-gradient(120% 120% at 50% 0%, #141a2b 0%, #0b0f1a 60%, #070a12 100%)' },
  { id: 'builtin:minimal-light', name: 'Paper', pack: 'minimal', scrim: 'light', css: 'radial-gradient(120% 120% at 50% 0%, #ffffff 0%, #eef1f6 100%)' },
  // Gradient
  { id: 'builtin:gradient-dawn', name: 'Dawn', pack: 'gradient', scrim: 'dark', css: 'linear-gradient(160deg, #2b1055 0%, #7597de 100%)' },
  { id: 'builtin:gradient-ember', name: 'Ember', pack: 'gradient', scrim: 'dark', css: 'linear-gradient(160deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
  { id: 'builtin:gradient-bloom', name: 'Bloom', pack: 'gradient', scrim: 'dark', css: 'linear-gradient(160deg, #42275a 0%, #734b6d 100%)' },
  // Nature
  { id: 'builtin:nature-forest', name: 'Forest', pack: 'nature', scrim: 'dark', css: 'linear-gradient(180deg, #0b3d2e 0%, #135e46 55%, #1d7a5c 100%)' },
  { id: 'builtin:nature-tide', name: 'Tide', pack: 'nature', scrim: 'dark', css: 'linear-gradient(180deg, #0a2540 0%, #14507a 60%, #1c7fb8 100%)' },
  // Abstract
  { id: 'builtin:abstract-mesh', name: 'Mesh', pack: 'abstract', scrim: 'dark', css: 'radial-gradient(40% 60% at 20% 20%, #3b1f6b 0%, transparent 60%), radial-gradient(40% 60% at 80% 30%, #1f4b6b 0%, transparent 60%), radial-gradient(60% 60% at 50% 90%, #6b1f4b 0%, transparent 60%), #0b0f1a' },
  { id: 'builtin:abstract-aurora', name: 'Aurora', pack: 'abstract', scrim: 'dark', css: 'radial-gradient(60% 40% at 30% 10%, #14532d 0%, transparent 55%), radial-gradient(50% 40% at 75% 20%, #0e7490 0%, transparent 55%), #05070d' },
  // Night sky
  { id: 'builtin:night-deep', name: 'Deep Sky', pack: 'night-sky', scrim: 'dark', css: 'radial-gradient(100% 80% at 50% 100%, #101a3a 0%, #060814 70%)' },
  { id: 'builtin:night-nebula', name: 'Nebula', pack: 'night-sky', scrim: 'dark', css: 'radial-gradient(50% 40% at 25% 30%, #3a1c71 0%, transparent 60%), radial-gradient(45% 45% at 80% 60%, #1c3a71 0%, transparent 60%), #04040c' },
];

/** The sentinel that means "follow the theme": light theme -> Paper,
 *  dark theme -> Ink. Stored in settings.wallpaperId by default. */
export const DEFAULT_WALLPAPER_ID = 'default';

export function getBuiltinWallpaper(id: string): BuiltinWallpaper | undefined {
  return BUILTIN_WALLPAPERS.find((w) => w.id === id);
}

/** Resolve a stored wallpaper id (which may be the "default" sentinel) into a
 *  concrete built-in wallpaper. Custom images are handled by the caller. */
export function resolveWallpaper(id: string, resolvedDark: boolean): BuiltinWallpaper {
  if (id === 'default' || id === 'builtin:minimal-dark' || id === 'builtin:minimal-light') {
    const wantDark = id === 'builtin:minimal-dark' || (id === 'default' && resolvedDark);
    return getBuiltinWallpaper(wantDark ? 'builtin:minimal-dark' : 'builtin:minimal-light')!;
  }
  return getBuiltinWallpaper(id) ?? getBuiltinWallpaper('builtin:minimal-dark')!;
}

export const WALLPAPER_PACKS: BuiltinWallpaper['pack'][] = [
  'minimal',
  'gradient',
  'nature',
  'abstract',
  'night-sky',
];
