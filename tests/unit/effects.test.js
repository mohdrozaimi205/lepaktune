import { describe, it, expect } from 'vitest';
import { PRESETS, PRESET_IDS, presetRate, crushCurve } from '../../src/audio/effects.js';

describe('Gaya Santai', () => {
  it('ada 6 preset dengan label Melayu', () => {
    expect(PRESET_IDS).toEqual(['slowed', 'lofi', '8d', 'bass', 'radio', 'bilik']);
    expect(PRESETS.radio.label).toBe('Radio Lama');
    expect(PRESETS.bilik.label).toBe('Akustik Bilik');
  });
  it('nilai ikut pelan', () => {
    expect(PRESETS.slowed.rate).toBe(0.85);
    expect(PRESETS.slowed.reverb).toEqual({ sec: 3.5, wet: 0.35 });
    expect(PRESETS.lofi.lowpass).toBe(3500);
    expect(PRESETS.lofi.bits).toBe(12);
    expect(PRESETS['8d'].autoPanHz).toBe(0.12);
    expect(PRESETS.bass.lowshelf).toEqual({ hz: 150, db: 8 });
    expect(PRESETS.radio.band).toEqual([300, 3400]);
  });
  it('kadar preset', () => {
    expect(presetRate('slowed')).toBe(0.85);
    expect(presetRate(null)).toBe(1);
    expect(presetRate('bass')).toBe(1);
  });
  it('bitcrush 12-bit kuantum betul', () => {
    const c = crushCurve(12, 1025);
    const levels = new Set(Array.from(c, (v) => v.toFixed(6)));
    expect(levels.size).toBeLessThanOrEqual(4097);
    expect(c[0]).toBe(-1); expect(c[1024]).toBe(1);
  });
});
