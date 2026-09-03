/**
 * Zero-dependency PWA icon generator.
 * Draws a simple clock glyph and encodes PNGs by hand (no canvas / sharp needed).
 * Output: public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png + public/favicon.svg
 */
import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// ---- CRC32 ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- simple drawing ----
function draw(size, { bleed }) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const bg = [11, 15, 26, 255]; // #0b0f1a
  const face = [246, 248, 252, 255];
  const accent = [59, 130, 246, 255]; // blue-500
  const faceR = bleed ? size * 0.5 : size * 0.44;
  const cornerR = size * 0.22;

  const inRoundRect = (x, y) => {
    if (bleed) return true;
    const m = size * 0.06;
    const rx = Math.min(x - m, size - m - x);
    const ry = Math.min(y - m, size - m - y);
    if (rx >= cornerR && ry >= cornerR) return true;
    const dx = Math.max(0, cornerR - rx);
    const dy = Math.max(0, cornerR - ry);
    return dx * dx + dy * dy <= cornerR * cornerR;
  };

  const hourAngle = -Math.PI / 3; // 10:00-ish
  const minAngle = Math.PI / 2 + 0.15;
  const hand = (angle, len, half) => {
    const ex = cx + Math.cos(angle) * len;
    const ey = cy + Math.sin(angle) * len;
    return (px, py) => {
      const vx = ex - cx;
      const vy = ey - cy;
      const t = Math.max(0, Math.min(1, ((px - cx) * vx + (py - cy) * vy) / (vx * vx + vy * vy)));
      const dx = px - (cx + vx * t);
      const dy = py - (cy + vy * t);
      return dx * dx + dy * dy <= half * half;
    };
  };
  const hourHand = hand(hourAngle, faceR * 0.42, size * 0.028);
  const minHand = hand(minAngle, faceR * 0.66, size * 0.022);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let c = bg;
      if (!inRoundRect(x + 0.5, y + 0.5)) {
        c = [0, 0, 0, 0];
      } else {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= faceR) c = face;
        if (d <= faceR && d >= faceR * 0.88) c = accent; // ring
        if (hourHand(x + 0.5, y + 0.5) || minHand(x + 0.5, y + 0.5)) c = bg;
        if (d <= size * 0.035) c = accent; // hub
      }
      rgba[i] = c[0];
      rgba[i + 1] = c[1];
      rgba[i + 2] = c[2];
      rgba[i + 3] = c[3];
    }
  }
  return encodePng(size, size, rgba);
}

writeFileSync(join(outDir, 'icon-192.png'), draw(192, { bleed: false }));
writeFileSync(join(outDir, 'icon-512.png'), draw(512, { bleed: false }));
writeFileSync(join(outDir, 'icon-maskable-512.png'), draw(512, { bleed: true }));
writeFileSync(join(outDir, 'apple-touch-icon.png'), draw(180, { bleed: true }));

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0b0f1a"/>
  <circle cx="32" cy="32" r="20" fill="none" stroke="#3b82f6" stroke-width="4"/>
  <line x1="32" y1="32" x2="32" y2="19" stroke="#f6f8fc" stroke-width="4" stroke-linecap="round"/>
  <line x1="32" y1="32" x2="42" y2="37" stroke="#f6f8fc" stroke-width="4" stroke-linecap="round"/>
  <circle cx="32" cy="32" r="3" fill="#3b82f6"/>
</svg>`;
writeFileSync(join(root, 'public', 'favicon.svg'), favicon);

console.log('Icons written to public/icons/');
