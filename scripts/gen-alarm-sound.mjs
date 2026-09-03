/**
 * Zero-dependency alarm tone generator for the native (Android) build.
 * Writes a ~24s 16-bit mono WAV to android/app/src/main/res/raw/alarm.wav —
 * this is what the notification channel plays when an alarm fires while the app
 * is closed (the in-app ring screen uses the Web Audio engine instead).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'android', 'app', 'src', 'main', 'res', 'raw');
mkdirSync(outDir, { recursive: true });

const RATE = 22050;
const SECONDS = 24;
const total = RATE * SECONDS;
const pcm = Buffer.alloc(total * 2);

// Classic two-tone alarm: 0.25s A, 0.25s B, repeat, with a short envelope so it
// isn't a harsh click. Loud but not clipping (0.7 amplitude).
const toneA = 880;
const toneB = 1174.7;
const slot = Math.floor(RATE * 0.28);

for (let i = 0; i < total; i++) {
  const t = i / RATE;
  const inSlot = i % slot;
  const useA = Math.floor(i / slot) % 2 === 0;
  const freq = useA ? toneA : toneB;
  // attack/release envelope within each slot
  const env = Math.min(1, inSlot / (RATE * 0.01), (slot - inSlot) / (RATE * 0.02));
  const sample = Math.sin(2 * Math.PI * freq * t) * 0.7 * Math.max(0, env);
  pcm.writeInt16LE(Math.round(sample * 32767), i * 2);
}

function wav(data) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // subchunk1 size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

writeFileSync(join(outDir, 'alarm.wav'), wav(pcm));
console.log('alarm.wav written to android/app/src/main/res/raw/');
