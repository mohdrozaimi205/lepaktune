import { test, expect } from '@playwright/test';
import { freshPage, addFixture, DOMINANT_FREQ_SRC } from './helpers.js';

test.beforeEach(async ({ page }) => { await freshPage(page); await addFixture(page, 'tone-10s.mp3'); });

test('tempo ubah panjang tanpa ubah nada; key ubah nada', async ({ page }) => {
  const r = await page.evaluate(async (src) => {
    const dom = eval(src);
    const { app, renderTempo } = window.__lepak;
    await app.loadSong(app.songs[0].id, { autoplay: false });
    const b = app.mixBuffer;
    const slow = await renderTempo(b, { tempo: 0.8 });
    const up = await renderTempo(b, { semitones: 2 });
    return { slowDur: slow.duration, slowF: dom(slow), upDur: up.duration, upF: dom(up) };
  }, DOMINANT_FREQ_SRC);
  expect(r.slowDur).toBeGreaterThan(12.4); expect(r.slowDur).toBeLessThan(12.6);
  expect(Math.abs(r.slowF - 440)).toBeLessThan(5);
  expect(Math.abs(r.upF - 493.9)).toBeLessThan(5);
  expect(Math.abs(r.upDur - 10)).toBeLessThan(0.1);
});

test('simpan semua format yang disokong dan boleh dibuka semula', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { app, encode, availableFormats, decodeFile, decodeContext } = window.__lepak;
    await app.loadSong(app.songs[0].id, { autoplay: false });
    const out = {};
    for (const f of await availableFormats()) {
      const blob = await encode(app.mixBuffer, f);
      const back = await decodeFile(blob, decodeContext());
      out[f] = { type: blob.type, dur: back.duration };
    }
    return out;
  });
  console.log('format:', JSON.stringify(r));
  expect(Object.keys(r)).toEqual(expect.arrayContaining(['mp3', 'wav']));
  for (const v of Object.values(r)) expect(Math.abs(v.dur - 10)).toBeLessThan(0.12);
  expect(r.mp3.type).toBe('audio/mpeg');
});

test('Gaya Santai: bass naik, radio potong treble, 8D gerak kiri-kanan, tiada klip', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { renderMix } = window.__lepak;
    const sr = 44100; const n = sr * 6;
    const src = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: sr });
    let seed = 7;
    for (let c = 0; c < 2; c++) { const d = src.getChannelData(c); for (let i = 0; i < n; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = (seed / 0x7fffffff * 2 - 1) * 0.3; } }
    const band = (buf, lo, hi) => { // tenaga jalur guna penapis offline
      return (async () => { const ctx = new OfflineAudioContext(1, buf.length, sr); const s = ctx.createBufferSource(); s.buffer = buf;
        let node = s; // 4 penapis setiap sisi supaya jalur tajam
        for (let k = 0; k < 4; k++) { const a = ctx.createBiquadFilter(); a.type = 'highpass'; a.frequency.value = lo; node = node.connect(a); }
        for (let k = 0; k < 4; k++) { const b = ctx.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = hi; node = node.connect(b); }
        node.connect(ctx.destination); s.start(); const o = await ctx.startRendering(); const d = o.getChannelData(0);
        let e = 0; for (let i = sr; i < d.length; i++) e += d[i] * d[i]; return 10 * Math.log10(e / (d.length - sr) + 1e-20); })();
    };
    const run = (preset) => renderMix({ mix: src }, { gains: { mix: 1 }, tempo: 1, semitones: 0, preset });
    const dry = await run(null);
    const res = {};
    const bass = await run('bass'); res.bassGain = (await band(bass, 20, 150)) - (await band(dry, 20, 150));
    const radio = await run('radio'); res.radioCut = (await band(dry, 5000, 20000)) - (await band(radio, 5000, 20000));
    const d8 = await run('8d');
    const lr = (t) => { const L = d8.getChannelData(0), R = d8.getChannelData(1); let el = 0, er = 0; for (let i = t * sr; i < (t + 0.5) * sr; i++) { el += L[i] ** 2; er += R[i] ** 2; } return 10 * Math.log10(el / er); };
    res.pan = [lr(0.5), lr(2), lr(4)];
    res.peaks = {};
    for (const p of [null, 'slowed', 'lofi', '8d', 'bass', 'radio', 'bilik']) {
      const b = await run(p); let pk = 0;
      for (let c = 0; c < 2; c++) for (const v of b.getChannelData(c)) pk = Math.max(pk, Math.abs(v));
      res.peaks[p || 'tiada'] = pk;
    }
    return res;
  });
  console.log('kesan:', JSON.stringify(r));
  expect(r.bassGain).toBeGreaterThan(6);
  expect(r.radioCut).toBeGreaterThan(20);
  expect(Math.max(...r.pan) - Math.min(...r.pan)).toBeGreaterThan(3);
  for (const v of Object.values(r.peaks)) expect(v).toBeLessThanOrEqual(1);
});
