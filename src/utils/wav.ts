/** Minimal shape of an AudioBuffer, so this stays testable without Web Audio. */
export interface PcmSource {
  numberOfChannels: number;
  sampleRate: number;
  length: number;
  getChannelData(channel: number): Float32Array;
}

/** 16-bit mono PCM WAV (channels mixed down), for Android's MediaPlayer. */
export function encodeWav(buf: PcmSource): Uint8Array<ArrayBuffer> {
  const n = buf.length;
  const out = new DataView(new ArrayBuffer(44 + n * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  out.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); // PCM
  out.setUint16(22, 1, true); // mono
  out.setUint32(24, buf.sampleRate, true);
  out.setUint32(28, buf.sampleRate * 2, true);
  out.setUint16(32, 2, true);
  out.setUint16(34, 16, true);
  str(36, 'data');
  out.setUint32(40, n * 2, true);
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (const ch of chans) v += ch[i];
    v = Math.max(-1, Math.min(1, v / chans.length));
    out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Uint8Array(out.buffer);
}
