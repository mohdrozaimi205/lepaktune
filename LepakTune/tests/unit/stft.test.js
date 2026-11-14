import { describe, it, expect } from 'vitest';
import { spec, ispec } from '../../src/ai/vendor/dsp.js';

describe('STFT', () => {
  it('istft(stft(x)) ≈ x', () => {
    const len = Math.floor(7.8 * 44100); // panjang segmen sebenar Demucs
    const data = new Float32Array(2 * len);
    for (let i = 0; i < data.length; i++) data[i] = Math.sin(i * 0.01) * 0.5 + Math.sin(i * 0.37) * 0.2;
    const x = { data, shape: [1, 2, len] };
    const z = spec(x);
    const y = ispec(z, len);
    let maxErr = 0;
    // tepi segmen memang tidak tepat dalam Demucs (bingkai tepi dibuang); segmen bertindih menutupnya
    for (let c = 0; c < 2; c++) for (let j = 4096; j < len - 4096; j++) { const i = c * len + j; maxErr = Math.max(maxErr, Math.abs(y.data[i] - data[i])); }
    expect(maxErr).toBeLessThan(1e-4);
    expect(y.data.some(Number.isNaN)).toBe(false);
  });
});
