import type { SoundRecipe } from '@/types';
import { getBuiltinSound } from '@/data/sounds';
import { storageService } from './storageService';

/**
 * AudioService — all sound goes through here.
 *
 * Design notes:
 * - Built-in sounds are synthesized: each recipe is rendered once with an
 *   OfflineAudioContext to an AudioBuffer, then looped gaplessly. No audio
 *   files ship with the app and nothing is fetched from the network.
 * - Uploaded sounds are decoded from their stored Blob and looped the same way.
 * - Modern browsers block audio until a user gesture. `unlock()` must be called
 *   from a click/tap once; after that alarms can start audio on their own.
 * - Every public method is guarded so a failing audio subsystem can never crash
 *   the alarm — the alarm UI + vibration still work without sound.
 */

export interface PlayHandle {
  readonly id: number;
  stop(fadeOutMs?: number): void;
  setVolume(v: number): void;
  /** Resolves when a non-looping sound finishes on its own. */
  readonly ended: Promise<void>;
}

type AnyAudioContext = AudioContext;

const NOOP_HANDLE: PlayHandle = {
  id: -1,
  stop() {},
  setVolume() {},
  ended: Promise.resolve(),
};

class AudioServiceImpl {
  private ctx: AnyAudioContext | null = null;
  private master: GainNode | null = null;
  private unlocked = false;
  private nextId = 1;
  private active = new Map<number, () => void>();
  private bufferCache = new Map<string, Promise<AudioBuffer | null>>();

  isUnlocked(): boolean {
    return this.unlocked;
  }

  isSupported(): boolean {
    return typeof (window.AudioContext ||
      (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext) !== 'undefined';
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  async unlock(): Promise<boolean> {
    try {
      const ctx = this.ensureCtx();
      if (!ctx) return false;
      if (ctx.state === 'suspended') await ctx.resume();
      const b = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = b;
      src.connect(ctx.destination);
      src.start(0);
      this.unlocked = ctx.state === 'running';
      return this.unlocked;
    } catch {
      return false;
    }
  }

  async play(
    soundId: string,
    opts: { volume: number; fadeInSeconds?: number; loop?: boolean } = { volume: 0.7 },
  ): Promise<PlayHandle> {
    try {
      const ctx = this.ensureCtx();
      if (!ctx || !this.master) return NOOP_HANDLE;
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

      const buffer = await this.resolveBuffer(soundId, ctx);
      if (!buffer) return NOOP_HANDLE;

      const loop = opts.loop ?? true;
      const targetVol = Math.max(0, Math.min(1, opts.volume));
      const fade = Math.max(0, opts.fadeInSeconds ?? 0);

      const gain = ctx.createGain();
      const now = ctx.currentTime;
      if (fade > 0) {
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(Math.max(0.0001, targetVol), now + fade);
      } else {
        gain.gain.setValueAtTime(targetVol, now);
      }

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = loop;
      src.connect(gain).connect(this.master);
      src.start();

      const id = this.nextId++;
      let resolveEnded: () => void = () => {};
      const ended = new Promise<void>((r) => (resolveEnded = r));

      const cleanup = () => {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
        try {
          src.disconnect();
          gain.disconnect();
        } catch {
          /* ignore */
        }
        this.active.delete(id);
        resolveEnded();
      };
      src.onended = cleanup;
      this.active.set(id, cleanup);

      return {
        id,
        ended,
        setVolume: (v: number) => {
          try {
            gain.gain.cancelScheduledValues(ctx.currentTime);
            gain.gain.setTargetAtTime(Math.max(0.0001, Math.min(1, v)), ctx.currentTime, 0.05);
          } catch {
            /* ignore */
          }
        },
        stop: (fadeOutMs = 120) => {
          try {
            const t = ctx.currentTime;
            gain.gain.cancelScheduledValues(t);
            gain.gain.setTargetAtTime(0.0001, t, Math.max(0.01, fadeOutMs / 1000 / 3));
            src.stop(t + fadeOutMs / 1000 + 0.05);
          } catch {
            cleanup();
          }
        },
      };
    } catch {
      return NOOP_HANDLE;
    }
  }

  /** Short, non-looping audition of a sound. Auto-stops after ~4.5s. */
  async preview(soundId: string, volume = 0.6): Promise<PlayHandle> {
    const h = await this.play(soundId, { volume, loop: true, fadeInSeconds: 0 });
    if (h.id !== -1) window.setTimeout(() => h.stop(200), 4500);
    return h;
  }

  stopAll(): void {
    for (const cleanup of [...this.active.values()]) cleanup();
    this.active.clear();
  }

  /** Drop a cached custom sound (after the user deletes an upload). */
  forget(soundId: string): void {
    this.bufferCache.delete(soundId);
  }

  // ---------------------------------------------------------------- internals

  private ensureCtx(): AnyAudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Impl =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Impl) return null;
      this.ctx = new Impl();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      return null;
    }
  }

  private resolveBuffer(soundId: string, ctx: AnyAudioContext): Promise<AudioBuffer | null> {
    const cached = this.bufferCache.get(soundId);
    if (cached) return cached;

    const p = (async (): Promise<AudioBuffer | null> => {
      if (soundId.startsWith('custom:')) {
        const blob = await storageService.getSound(soundId.slice('custom:'.length));
        if (blob) {
          try {
            return await ctx.decodeAudioData(await blob.arrayBuffer());
          } catch {
            /* fall through to a built-in */
          }
        }
        return this.renderRecipe(getBuiltinSound('builtin:classic-alarm')!.recipe);
      }
      const b = getBuiltinSound(soundId) ?? getBuiltinSound('builtin:soft-piano')!;
      return this.renderRecipe(b.recipe);
    })();

    this.bufferCache.set(soundId, p);
    return p;
  }

  private async renderRecipe(recipe: SoundRecipe): Promise<AudioBuffer | null> {
    try {
      const sr = 44_100;
      const total = recipe.notes.length * recipe.noteDuration + recipe.loopGap;
      const OfflineImpl =
        window.OfflineAudioContext ||
        (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
          .webkitOfflineAudioContext;
      if (!OfflineImpl) return null;
      const off = new OfflineImpl(1, Math.max(1, Math.ceil(total * sr)), sr);
      const bus = off.createGain();
      bus.gain.value = 0.9;
      bus.connect(off.destination);

      if (recipe.tremolo && recipe.tremolo > 0) {
        const lfo = off.createOscillator();
        lfo.frequency.value = recipe.tremolo;
        const lfoGain = off.createGain();
        lfoGain.gain.value = 0.3;
        lfo.connect(lfoGain).connect(bus.gain);
        lfo.start(0);
        lfo.stop(total);
      }

      recipe.notes.forEach((freq, i) => {
        if (!freq) return;
        const t0 = i * recipe.noteDuration;
        const dur = recipe.noteDuration;
        const spawn = (detune: number) => {
          const osc = off.createOscillator();
          osc.type = recipe.wave;
          osc.frequency.value = freq;
          osc.detune.value = detune;
          const g = off.createGain();
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(1, t0 + Math.min(recipe.attack, dur * 0.4));
          g.gain.setValueAtTime(1, Math.max(t0 + recipe.attack, t0 + dur - recipe.release));
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
          osc.connect(g).connect(bus);
          osc.start(t0);
          osc.stop(t0 + dur + 0.02);
        };
        spawn(0);
        if (recipe.detune) spawn(recipe.detune);
      });

      return await off.startRendering();
    } catch {
      return null;
    }
  }
}

export const audioService = new AudioServiceImpl();
export type AudioService = AudioServiceImpl;
