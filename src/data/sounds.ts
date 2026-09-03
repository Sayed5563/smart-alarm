import type { BuiltinSound } from '@/types';

/** All alarm audio is synthesized at runtime with the Web Audio API — there are
 *  no bundled audio files and no network requests. Each recipe is a tiny note
 *  loop the AudioService turns into a gapless, loopable alarm tone. */
export const BUILTIN_SOUNDS: BuiltinSound[] = [
  {
    id: 'builtin:soft-piano',
    name: 'Soft Piano',
    group: 'gentle',
    recipe: { wave: 'triangle', notes: [523.25, 659.25, 783.99, 659.25], noteDuration: 0.5, loopGap: 0.4, attack: 0.03, release: 0.35, detune: 4, tremolo: 0 },
  },
  {
    id: 'builtin:calm-bells',
    name: 'Calm Bells',
    group: 'gentle',
    recipe: { wave: 'sine', notes: [880, 1174.66, 987.77, 1318.51], noteDuration: 0.6, loopGap: 0.6, attack: 0.005, release: 0.5, detune: 2, tremolo: 0 },
  },
  {
    id: 'builtin:rain',
    name: 'Rain',
    group: 'gentle',
    recipe: { wave: 'sine', notes: [196, 220, 174.61, 207.65], noteDuration: 0.9, loopGap: 0.1, attack: 0.2, release: 0.7, detune: 8, tremolo: 6 },
  },
  {
    id: 'builtin:classic-alarm',
    name: 'Classic Alarm',
    group: 'energetic',
    recipe: { wave: 'square', notes: [880, 880, 0, 880, 880, 0], noteDuration: 0.14, loopGap: 0.25, attack: 0.003, release: 0.05 },
  },
  {
    id: 'builtin:beeps',
    name: 'Beeps',
    group: 'energetic',
    recipe: { wave: 'square', notes: [1046.5, 0, 1046.5, 0, 1046.5, 0], noteDuration: 0.1, loopGap: 0.5, attack: 0.002, release: 0.03 },
  },
  {
    id: 'builtin:rising-tone',
    name: 'Rising Tone',
    group: 'energetic',
    recipe: { wave: 'sawtooth', notes: [440, 554.37, 659.25, 830.61, 1046.5], noteDuration: 0.16, loopGap: 0.3, attack: 0.005, release: 0.06 },
  },
  {
    id: 'builtin:cartoon',
    name: 'Cartoon',
    group: 'fun',
    recipe: { wave: 'triangle', notes: [523.25, 784, 523.25, 392, 659.25], noteDuration: 0.13, loopGap: 0.35, attack: 0.005, release: 0.08 },
  },
  {
    id: 'builtin:digital',
    name: 'Digital',
    group: 'fun',
    recipe: { wave: 'square', notes: [1318.51, 1567.98, 1318.51, 1567.98], noteDuration: 0.09, loopGap: 0.22, attack: 0.002, release: 0.02 },
  },
  {
    id: 'builtin:bright-bells',
    name: 'Bright Bells',
    group: 'fun',
    recipe: { wave: 'sine', notes: [1567.98, 2093, 1760, 2349.32], noteDuration: 0.28, loopGap: 0.3, attack: 0.004, release: 0.25, detune: 3 },
  },
];

export const DEFAULT_SOUND_ID = 'builtin:soft-piano';
export const PRE_ALARM_SOUND_ID = 'builtin:rain';

export function getBuiltinSound(id: string): BuiltinSound | undefined {
  return BUILTIN_SOUNDS.find((s) => s.id === id);
}

export const SOUND_GROUPS: { key: BuiltinSound['group']; labelKey: string }[] = [
  { key: 'gentle', labelKey: 'sounds.group.gentle' },
  { key: 'energetic', labelKey: 'sounds.group.energetic' },
  { key: 'fun', labelKey: 'sounds.group.fun' },
];
