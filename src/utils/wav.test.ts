import { describe, expect, it } from 'vitest';
import { encodeWav } from './wav';

describe('encodeWav', () => {
  it('writes a mono 16-bit header and mixes channels down', () => {
    const l = new Float32Array([1, -1, 0.5]);
    const r = new Float32Array([1, -1, -0.5]);
    const wav = encodeWav({ numberOfChannels: 2, sampleRate: 8000, length: 3, getChannelData: (c) => (c ? r : l) });
    const dv = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
    expect(dv.getUint16(22, true)).toBe(1);
    expect(dv.getUint32(24, true)).toBe(8000);
    expect(dv.getUint32(40, true)).toBe(6);
    expect([dv.getInt16(44, true), dv.getInt16(46, true), dv.getInt16(48, true)]).toEqual([32767, -32768, 0]);
  });
});
